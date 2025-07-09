import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { Send, Trash2, Shield, PlusSquare, MessageSquare, Copy, Check, AlertCircle, Clock } from "lucide-react";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import type { Realm } from "./RealmsPage"; // Assuming RealmsPage exports Realm interface
import { RealmSuggestionMenu } from "../components/RealmSuggestionMenu";
import { useLoading } from "../lib/LoadingContext";

interface Chat {
  id: string;
  title: string;
  realm_id: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Message {
  role: "user" | "model";
  content: string;
  timestamp?: string;
  id?: string;
}

interface Text {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface MessageActionsProps {
  message: Message;
  onCopy: () => void;
  copied: boolean;
}

const MessageActions = ({ message, onCopy, copied }: MessageActionsProps) => {
  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2">
      <button
        onClick={onCopy}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black hover:bg-opacity-5 dark:hover:bg-white dark:hover:bg-opacity-10 transition-all duration-200"
        title="Copy message"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

const MessageBubble = ({ message, isUser }: { message: Message; isUser: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const renderMessageContent = (content: string) => {
    if (isUser) {
      // For user messages, highlight @mentions (both realms and texts)
      const mentionRegex = /@(?:"([^"]+)"|(\S+(?:\s+\S+)*)(?=\s|$|[,.!?]))/g;
      const parts: (string | ReactNode)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = mentionRegex.exec(content)) !== null) {
        // Add text before the mention
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        
        // Add the highlighted mention
        const mentionText = match[0];
        parts.push(
          <span key={`mention-${match.index}`} className="bg-black bg-opacity-10 px-1.5 py-0.5 rounded text-gray-800 font-medium">
            {mentionText}
          </span>
        );
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }
      
      return (
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {parts.map((part, index) => (
            typeof part === 'string' ? <span key={index}>{part}</span> : part
          ))}
        </div>
      );
    }
    
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <MarkdownRenderer content={content} />
      </div>
    );
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group mb-6`}>
      <div className={`relative max-w-[80%] lg:max-w-3xl`}>
        {/* Message Content */}
        <div
          className={`relative px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          } ${message.content ? '' : 'min-h-[48px] flex items-center'}`}
        >
          <MessageActions message={message} onCopy={handleCopy} copied={copied} />
          
          {message.content ? (
            renderMessageContent(message.content)
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ChatSidebar({
  chats,
  onSelectChat,
  currentChatId,
  onNewChat,
  onDeleteChat,
  isLoading,
}: {
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  currentChatId: string | null;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  isLoading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDeleteClick = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm(chatId);
  };

  const confirmDelete = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteChat(chatId);
    setDeleteConfirm(null);
  };

  return (
    <div
      className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
        isExpanded ? "w-80" : "w-16 lg:w-20"
      } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false);
        setDeleteConfirm(null);
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {isExpanded ? (
            <>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversations</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
                </p>
              </div>
              <button
                onClick={onNewChat}
                className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                title="New Chat"
              >
                <PlusSquare className="w-4 h-4 mr-1" />
                New
              </button>
            </>
          ) : (
            <button
              onClick={onNewChat}
              className="w-8 h-8 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="New Chat"
            >
              <PlusSquare className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            {isExpanded && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading chats...</p>
            )}
          </div>
        ) : chats.length > 0 ? (
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  currentChatId === chat.id
                    ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent"
                }`}
              >
                {isExpanded ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                            currentChatId === chat.id 
                              ? "text-blue-600 dark:text-blue-400" 
                              : "text-gray-400 dark:text-gray-500"
                          }`} />
                          <h3 className={`text-sm font-medium truncate ${
                            currentChatId === chat.id
                              ? "text-blue-900 dark:text-blue-100"
                              : "text-gray-900 dark:text-gray-100"
                          }`}>
                            {chat.title}
                          </h3>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDate(chat.updated_at || chat.created_at)}
                        </div>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {deleteConfirm === chat.id ? (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => confirmDelete(chat.id, e)}
                              className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Confirm Delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm(null);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleDeleteClick(chat.id, e)}
                            className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-center">
                    <MessageSquare className={`w-5 h-5 ${
                      currentChatId === chat.id 
                        ? "text-blue-600 dark:text-blue-400" 
                        : "text-gray-400 dark:text-gray-500"
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          isExpanded && (
            <div className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Start a new chat to begin</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const { isLoading, setIsLoading } = useLoading();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [texts, setTexts] = useState<Text[]>([]);
  const [showRealmSuggestions, setShowRealmSuggestions] = useState(false);
  const [realmSearchTerm, setRealmSearchTerm] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get cursor position for @ mention dropdown
  const getCursorPosition = () => {
    if (!inputRef.current) return { top: 0, left: 0 };
    
    const input = inputRef.current;
    const rect = input.getBoundingClientRect();
    const style = window.getComputedStyle(input);
    const paddingLeft = parseInt(style.paddingLeft);
    
    // Create a temporary span to measure text width
    const temp = document.createElement('span');
    temp.style.font = style.font;
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.whiteSpace = 'pre';
    temp.textContent = input.value.substring(0, input.selectionStart || 0);
    document.body.appendChild(temp);
    
    const textWidth = temp.offsetWidth;
    document.body.removeChild(temp);
    
    return {
      top: rect.top,
      left: rect.left + paddingLeft + Math.min(textWidth, rect.width - paddingLeft - 20)
    };
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleNewChat();
            break;
          case '/':
            e.preventDefault();
            inputRef.current?.focus();
            break;
        }
      }
      
      // Escape to clear realm suggestions
      if (e.key === 'Escape') {
        setShowRealmSuggestions(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchRealms = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/realms");
      if (!response.ok) throw new Error('Failed to fetch realms');
      const data = await response.json();
      setRealms(data);
    } catch (error) {
      console.error('Error fetching realms:', error);
      setError('Failed to load realms');
    }
  }, []);

  const fetchTexts = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/texts");
      if (!response.ok) throw new Error('Failed to fetch texts');
      const data = await response.json();
      setTexts(data);
    } catch (error) {
      console.error('Error fetching texts:', error);
      setError('Failed to load texts');
    }
  }, []);

  const fetchChats = useCallback(async () => {
    setChatsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/chats");
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      setChats(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Failed to load conversations');
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
    fetchRealms();
    fetchTexts();
  }, [fetchChats, fetchRealms, fetchTexts]);

  const fetchMessages = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/chats/${id}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.map((msg: any) => ({
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString()
      })));
      setError(null);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
    }
  };

  useEffect(() => {
    if (chatId) {
      if (!isLoading) {
        fetchMessages(chatId);
      }
    } else {
      setMessages([]);
    }
  }, [chatId, isLoading]);

  const handleNewChat = () => {
    setChatId(null);
    setMessages([]);
    setError(null);
    setShowRealmSuggestions(false);
    inputRef.current?.focus();
  };
  
  const handleDeleteChat = async (chatIdToDelete: string) => {
    try {
      await fetch(`http://localhost:8000/chats/${chatIdToDelete}`, {
        method: 'DELETE',
      });
      fetchChats();
      if (chatId === chatIdToDelete) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      setError('Failed to delete chat');
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    if (!chatId || !newTitle.trim()) {
      setEditingTitle(false);
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        await fetchChats();
      }
    } catch (error) {
      console.error('Failed to update title:', error);
      setError('Failed to update chat title');
    }
    setEditingTitle(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setInput(value);

    // Check for @ mention at cursor position
    const textBeforeCursor = value.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    
    if (match) {
      setShowRealmSuggestions(true);
      setRealmSearchTerm(match[1]);
      setMentionPosition(getCursorPosition());
    } else {
      setShowRealmSuggestions(false);
    }
  };

  const handleSelectRealm = (realm: Realm) => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    
    // Find the @ mention to replace
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const mentionStart = cursorPos - mentionMatch[0].length;
      const newText = input.substring(0, mentionStart) + `@${realm.name} ` + textAfterCursor;
      setInput(newText);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = mentionStart + `@${realm.name} `.length;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    }
    
    setShowRealmSuggestions(false);
  };

  const handleSelectText = (text: Text) => {
    if (!inputRef.current) return;
    
    const cursorPos = inputRef.current.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    
    // Find the @ mention to replace
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const mentionStart = cursorPos - mentionMatch[0].length;
      const newText = input.substring(0, mentionStart) + `@${text.title} ` + textAfterCursor;
      setInput(newText);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = mentionStart + `@${text.title} `.length;
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current?.focus();
      }, 0);
    }
    
    setShowRealmSuggestions(false);
  };

  const extractRealmFromMessage = (message: string) => {
    const mentionMatch = message.match(/@(\w+)/);
    if (mentionMatch) {
      const realmName = mentionMatch[1];
      const realm = realms.find(r => r.name === realmName);
      return realm?.id || null;
    }
    return null;
  };

  const extractTextFromMessage = (message: string) => {
    const mentionMatch = message.match(/@([^@\s]+)/g);
    if (mentionMatch) {
      // Check if any mentions match text titles instead of realm names
      for (const mention of mentionMatch) {
        const textName = mention.substring(1); // Remove @
        const text = texts.find(t => t.title === textName);
        if (text) {
          return text.id;
        }
      }
    }
    return null;
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
  
    setIsLoading(true);
    setError(null);
    const messageToSend = input;
    setInput("");
    setShowRealmSuggestions(false);
  
    const userMessage: Message = { 
      role: "user", 
      content: messageToSend,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };
    setMessages((prev) => [...prev, userMessage]);
  
    // Extract realm or text from @ mention in the message
    const realmId = extractRealmFromMessage(messageToSend);
    const textId = extractTextFromMessage(messageToSend);
    
    const requestBody: { message: string; chat_id: string | null; realm_id?: string | null; text_id?: string | null } = {
      message: messageToSend,
      chat_id: chatId,
    };

    if (realmId) {
      requestBody.realm_id = realmId;
    } else if (textId) {
      requestBody.text_id = textId;
    }

    try {
      const response = await fetch("http://localhost:8000/chats/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    
      if (!response.body) {
        throw new Error('No response body');
      }
    
      const modelPlaceholder: Message = { 
        role: "model", 
        content: "",
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };
      setMessages((prev) => [...prev, modelPlaceholder]);

      const returnedChatId = response.headers.get("X-Chat-Id");
      if (returnedChatId && !chatId) {
        setChatId(returnedChatId);
        fetchChats();
      }
    
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
    
      reader.read().then(function processText({ done, value }): any {
        if (done) {
          setIsLoading(false);
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
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('Failed to send message. Please try again.');
      setIsLoading(false);
      // Remove the optimistic user message on error
      setMessages((prev) => prev.slice(0, -1));
      setInput(messageToSend); // Restore the input
    }
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
        isLoading={chatsLoading}
      />
      
      <div className="flex-1 flex flex-col min-w-0 ml-16 lg:ml-20">
        {/* Header */}
        <header className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {/* Chat Title Section */}
          {editingTitle && chatId ? (
            <input
              type="text"
              defaultValue={chats.find(c => c.id === chatId)?.title || ''}
              onBlur={(e) => handleUpdateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateTitle(e.currentTarget.value);
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="text-xl font-semibold bg-transparent border-b border-gray-300 focus:border-gray-600 focus:outline-none dark:text-gray-100 dark:border-gray-600 dark:focus:border-gray-400 w-full max-w-md"
              autoFocus
            />
          ) : (
            <div>
              <h1 
                className="text-xl font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                onClick={() => {
                  if(chatId) setEditingTitle(true);
                }}
                title={chatId ? "Click to edit title" : ""}
              >
                {currentChat?.title || 'New Chat'}
              </h1>
              {currentRealm && (
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <Shield className="w-3.5 h-3.5 mr-1.5" />
                  <span>{currentRealm.name}</span>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center max-w-4xl mx-auto">
              <AlertCircle className="w-4 h-4 text-red-500 mr-3 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</span>
              <button 
                onClick={() => setError(null)}
                className="ml-3 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pb-32 pt-0">
          <div className="max-w-4xl mx-auto w-full p-6">
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <MessageBubble 
                    key={msg.id || index} 
                    message={msg} 
                    isUser={msg.role === "user"} 
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[500px]">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Start a conversation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Ask me anything. Use <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">@</span> to 
                    reference your contexts.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="fixed bottom-0 left-16 lg:left-20 right-0 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900 dark:to-transparent pt-8 pb-6 z-10">
          <div className="max-w-4xl mx-auto px-6">
            <div className="relative">
              {showRealmSuggestions && (
                <RealmSuggestionMenu
                  realms={realms}
                  onSelectRealm={handleSelectRealm}
                  onSelectText={handleSelectText}
                  searchTerm={realmSearchTerm}
                  position={mentionPosition}
                  onClose={() => setShowRealmSuggestions(false)}
                />
              )}
              
              <div className="flex items-end space-x-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-1">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        // Don't send message if realm suggestions are open
                        if (showRealmSuggestions) {
                          return;
                        }
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Message..."
                    className="w-full p-4 bg-transparent border-none focus:outline-none dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                    disabled={isLoading}
                    maxLength={2000}
                  />
                </div>
                
                <button
                  onClick={handleSendMessage}
                  className="group relative p-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-600 dark:disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 m-1 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 disabled:hover:shadow-lg"
                  disabled={isLoading || !input.trim()}
                  title="Send message"
                >
                  <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 