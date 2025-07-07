import { useState, useEffect, useCallback } from "react";
import { Send, Trash2, Shield } from "lucide-react";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Realm } from "./RealmsPage"; // Assuming RealmsPage exports Realm interface

interface Chat {
  id: string;
  title: string;
  realm_id: string | null;
}

interface Message {
  role: "user" | "model";
  content: string;
}

function ChatSidebar({
  chats,
  onSelectChat,
  currentChatId,
  onNewChat,
  onDeleteChat,
}: {
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  currentChatId: string | null;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}) {
  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-800 border-r dark:border-gray-700 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold dark:text-gray-100">Recent Chats</h2>
        <button
          onClick={onNewChat}
          className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-100"
        >
          New Chat
        </button>
      </div>
      <ul className="space-y-2">
        {chats.map((chat) => (
          <li key={chat.id} className="flex items-center justify-between">
            <button
              onClick={() => onSelectChat(chat.id)}
              className={`block w-full text-left p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-sm dark:text-gray-200 ${
                chat.id === currentChatId ? "bg-gray-200 dark:bg-gray-700 font-semibold" : ""
              }`}
            >
              {chat.title}
            </button>
            <button
              onClick={() => onDeleteChat(chat.id)}
              className="p-2 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [selectedRealmId, setSelectedRealmId] = useState<string | null>(null);

  const fetchRealms = useCallback(async () => {
    const response = await fetch("http://localhost:8000/realms");
    const data = await response.json();
    setRealms(data);
  }, []);

  const fetchChats = useCallback(async () => {
    const response = await fetch("http://localhost:8000/chats");
    const data = await response.json();
    setChats(data);
  }, []);

  useEffect(() => {
    fetchChats();
    fetchRealms();
  }, [fetchChats, fetchRealms]);

  const fetchMessages = async (id: string) => {
    const response = await fetch(`http://localhost:8000/chats/${id}/messages`);
    const data = await response.json();
    setMessages(data);
  };

  useEffect(() => {
    if (chatId) {
      if (!isLoading) {
        fetchMessages(chatId);
      }
    } else {
      // Only clear messages if there is no active chat
      setMessages([]);
    }
  }, [chatId, isLoading]);

  const handleNewChat = () => {
    setChatId(null);
    setMessages([]);
  };
  
  const handleDeleteChat = async (chatIdToDelete: string) => {
    if (window.confirm("Are you sure you want to delete this chat?")) {
      await fetch(`http://localhost:8000/chats/${chatIdToDelete}`, {
        method: 'DELETE',
      });
      fetchChats(); // Refresh chat list
      if (chatId === chatIdToDelete) {
        handleNewChat(); // Clear the main view if the active chat was deleted
      }
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!chatId || !newTitle.trim()) {
      setEditingTitle(false);
      return;
    }

    const response = await fetch(`http://localhost:8000/chats/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });

    if (response.ok) {
      await fetchChats();
    }
    setEditingTitle(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
  
    setIsLoading(true);
    const messageToSend = input;
    setInput("");
  
    // Immediately add the user's message for an optimistic update
    const userMessage: Message = { role: "user", content: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
  
    const requestBody: { message: string; chat_id: string | null; realm_id?: string | null } = {
      message: messageToSend,
      chat_id: chatId,
    };

    if (selectedRealmId && !chatId) {
      requestBody.realm_id = selectedRealmId;
    }

    const response = await fetch("http://localhost:8000/llm/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  
    if (!response.body) {
      setIsLoading(false);
      // Optional: Handle error, maybe remove the optimistic message
      return;
    }
  
    // Add the model's placeholder now that we have a response
    const modelPlaceholder: Message = { role: "model", content: "" };
    setMessages((prev) => [...prev, modelPlaceholder]);

    const returnedChatId = response.headers.get("X-Chat-Id");
    if (returnedChatId && !chatId) {
      setChatId(returnedChatId);
      fetchChats(); // New chat created, refresh sidebar
      setSelectedRealmId(null);
    }
  
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
  
    reader.read().then(function processText({ done, value }): any {
      if (done) {
        setIsLoading(false);
        // On stream completion, you might want to refetch the final state 
        // from the DB to ensure consistency, but it's optional.
        return;
      }
  
      const chunk = decoder.decode(value, { stream: true });
      setMessages((prev) =>
        prev.map((msg, index) => {
          if (index === prev.length - 1) {
            return { ...msg, content: msg.content + chunk };
          }
          return msg;
        })
      );
  
      return reader.read().then(processText);
    });
  };

  const currentChat = chatId ? chats.find(c => c.id === chatId) : null;
  const currentRealm = currentChat?.realm_id ? realms.find(r => r.id === currentChat.realm_id) : null;

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      <ChatSidebar
        chats={chats}
        onSelectChat={setChatId}
        currentChatId={chatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex-1 flex flex-col">
        <header className="p-4 border-b dark:border-gray-700">
          {editingTitle && chatId ? (
            <input
              type="text"
              defaultValue={chats.find(c => c.id === chatId)?.title || ''}
              onBlur={(e) => handleUpdateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateTitle(e.currentTarget.value);
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="text-xl font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none dark:text-gray-100"
              autoFocus
            />
          ) : (
            <div>
              <h2 
                className="text-xl font-semibold dark:text-gray-100 cursor-pointer"
                onClick={() => {
                  if(chatId) setEditingTitle(true);
                }}
              >
                {currentChat?.title || 'New Chat'}
              </h2>
              {currentRealm && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <Shield size={14} className="mr-1" />
                  <span>{currentRealm.name}</span>
                </div>
              )}
            </div>
          )}
        </header>
        <div className="flex-grow p-4 overflow-y-auto">
          {messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white max-w-md"
                        : "bg-gray-200 dark:bg-gray-700 max-w-5xl"
                    }`}
                  >
                    {msg.role === "model" ? (
                      msg.content ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <LoadingSpinner />
                      )
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">
                Your personal reflection space. Start a new conversation.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t dark:border-gray-700">
          {!chatId && (
            <div className="mb-2">
              <label htmlFor="realm-select" className="text-sm text-gray-600 dark:text-gray-400">Attach Realm (optional)</label>
              <select
                id="realm-select"
                value={selectedRealmId || ""}
                onChange={(e) => setSelectedRealmId(e.target.value || null)}
                className="w-full mt-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              >
                <option value="">None</option>
                {realms.map(realm => (
                  <option key={realm.id} value={realm.id}>{realm.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              placeholder="Your personal reflection space. Start a new conversation."
              className="w-full pr-12 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-500 hover:text-blue-500 disabled:opacity-50"
              disabled={isLoading}
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 