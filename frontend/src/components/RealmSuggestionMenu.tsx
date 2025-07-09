import { useState, useEffect, useRef } from "react";
import type { Realm } from "../pages/RealmsPage";
import { Shield, FileText, ArrowLeft, Clock } from "lucide-react";

interface Text {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface RealmSuggestionMenuProps {
  realms: Realm[];
  onSelectRealm: (realm: Realm) => void;
  onSelectText: (text: Text) => void;
  searchTerm: string;
  position?: { top: number; left: number };
  onClose?: () => void;
}

export function RealmSuggestionMenu({
  realms,
  onSelectRealm,
  onSelectText,
  searchTerm,
  position = { top: 0, left: 0 },
  onClose
}: RealmSuggestionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'main' | 'texts'>('main');
  const [texts, setTexts] = useState<Text[]>([]);
  const [textsLoading, setTextsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch texts when switching to text view
  const fetchTexts = async () => {
    setTextsLoading(true);
    try {
      const response = await fetch("http://localhost:8000/texts");
      if (response.ok) {
        const data = await response.json();
        // Sort by most recent and limit to 10
        const sortedTexts = data
          .sort((a: Text, b: Text) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10);
        setTexts(sortedTexts);
      }
    } catch (error) {
      console.error('Failed to fetch texts:', error);
    } finally {
      setTextsLoading(false);
    }
  };

  // Main view items: realms + text option
  const filteredRealms = realms.filter((realm) =>
    realm.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const textOption = {
    id: 'texts',
    name: 'Text Documents',
    type: 'text-option' as const
  };

  const mainItems = [
    ...filteredRealms.map(realm => ({ ...realm, type: 'realm' as const })),
    ...(searchTerm === '' || 'text'.includes(searchTerm.toLowerCase()) ? [textOption] : [])
  ];

  // Text view items: filtered texts
  const filteredTexts = texts.filter((text) =>
    text.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentItems = viewMode === 'main' ? mainItems : filteredTexts.map(text => ({ ...text, type: 'text' as const }));

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm, currentItems.length, viewMode]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentItems.length) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => 
            prev < currentItems.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => 
            prev > 0 ? prev - 1 : currentItems.length - 1
          );
          break;
        case 'ArrowLeft':
          if (viewMode === 'texts') {
            e.preventDefault();
            e.stopPropagation();
            setViewMode('main');
          }
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          handleItemSelect(currentItems[selectedIndex]);
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentItems, selectedIndex, viewMode, onClose]);

  const handleItemSelect = (item: any) => {
    if (item.type === 'realm') {
      onSelectRealm(item);
    } else if (item.type === 'text-option') {
      setViewMode('texts');
      fetchTexts();
      return; // Don't close menu when navigating to texts view
    } else if (item.type === 'text') {
      onSelectText(item);
    }
    
    // Close menu after selection (except for text-option navigation)
    onClose?.();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (currentItems.length === 0 && viewMode === 'main') {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1 min-w-[240px] max-w-[320px]"
      style={{
        top: position.top - 8,
        left: position.left,
        transform: 'translateY(-100%)'
      }}
    >
      {/* Header for text view */}
      {viewMode === 'texts' && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <button
            onClick={() => setViewMode('main')}
            className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to realms</span>
          </button>
        </div>
      )}

      {/* Loading state for texts */}
      {viewMode === 'texts' && textsLoading && (
        <div className="px-3 py-4 text-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading texts...</span>
        </div>
      )}

      {/* Items list */}
      {!textsLoading && (
        <div className="max-h-64 overflow-y-auto">
          {currentItems.length > 0 ? (
            currentItems.slice(0, 8).map((item: any, index) => (
              <button
                key={item.id}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2 text-sm ${
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300"
                }`}
                onClick={() => handleItemSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {item.type === 'realm' && (
                  <>
                    <Shield className={`w-3.5 h-3.5 flex-shrink-0 ${
                      index === selectedIndex
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`} />
                    <span className="truncate">{item.name}</span>
                  </>
                )}
                
                {item.type === 'text-option' && (
                  <>
                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                      index === selectedIndex
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`} />
                    <span className="truncate">Text Documents</span>
                    <span className="text-xs text-gray-400 ml-auto">→</span>
                  </>
                )}
                
                {item.type === 'text' && (
                  <>
                    <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                      index === selectedIndex
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="flex items-center space-x-1 text-xs text-gray-400 dark:text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(item.created_at)}</span>
                      </div>
                    </div>
                  </>
                )}
              </button>
            ))
          ) : viewMode === 'texts' ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? `No texts found for "${searchTerm}"` : 'No texts available'}
            </div>
          ) : null}
        </div>
      )}
      
      {/* Footer with count */}
      {currentItems.length > 8 && (
        <div className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
          +{currentItems.length - 8} more...
        </div>
      )}
    </div>
  );
} 