import { Send } from "lucide-react";

function ChatSidebar() {
  const recentChats = [
    { id: 1, title: "Career Goals" },
    { id: 2, title: "Project Phoenix Ideas" },
    { id: 3, title: "Personal Growth Plan" },
  ];

  return (
    <div className="w-80 bg-gray-50 border-r p-4 flex flex-col">
      <h2 className="text-lg font-semibold mb-4">Recent Chats</h2>
      <ul className="space-y-2">
        {recentChats.map((chat) => (
          <li key={chat.id}>
            <a
              href="#"
              className="block p-2 rounded-lg hover:bg-gray-200 text-sm"
            >
              {chat.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatPage() {
  const messages = [
    { role: "user", content: "Hello, who are you?" },
    {
      role: "model",
      content:
        "I am a helpful AI assistant. How can I help you today?",
    },
    { role: "user", content: "Tell me about the Realms feature." },
    {
      role: "model",
      content:
        "Realms are persistent contexts for our conversations. You can create different realms for different topics, like 'Career' or 'Personal Growth'. This helps me provide more relevant and insightful responses over time.",
    },
  ];

  return (
    <div className="flex h-full">
      <ChatSidebar />
      <div className="flex-1 flex flex-col">
        <header className="p-4 border-b">
          <h2 className="text-xl font-semibold">Chat</h2>
        </header>
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-lg p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t">
          <div className="relative">
            <input
              type="text"
              placeholder="Type your message..."
              className="w-full pr-12 p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
            <button className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-gray-500 hover:text-blue-500">
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 