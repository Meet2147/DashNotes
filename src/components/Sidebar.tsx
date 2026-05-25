'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Moon,
  Sun,
  Plus,
  ChevronRight,
  FolderOpen,
  Tag,
  Settings,
  X,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { createClient } from '@/lib/supabase/client';
import { Collection } from '@/types';

function NavItem({
  icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${collapsed ? 'justify-center' : ''}
        ${
          active
            ? 'bg-violet-100 text-violet-700'
            : 'text-gray-600 hover:bg-gray-100'
        }
      `}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

const COLLECTION_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#DC2626',
  '#D97706', '#DB2777', '#0891B2', '#65A30D',
];

export default function Sidebar() {
  const {
    view,
    setView,
    searchQuery,
    setSearchQuery,
    selectedCollectionId,
    setSelectedCollectionId,
    setSelectedNoteId,
    sidebarOpen,
    toggleSidebar,
    setMobilePanel,
  } = useAppStore();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState(COLLECTION_COLORS[0]);
  const [userEmail, setUserEmail] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const loadCollections = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('collections')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setCollections(data);
  }, []);

  useEffect(() => {
    loadCollections();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? '');
    });
  }, [loadCollections]);

  const handleNavClick = (v: typeof view) => {
    setView(v);
    if (v !== 'collection') setSelectedCollectionId(null);
    setSelectedNoteId(null);
    setMobilePanel('notes');
  };

  const handleCollectionClick = (id: string) => {
    setView('collection');
    setSelectedCollectionId(id);
    setSelectedNoteId(null);
    setMobilePanel('notes');
  };

  const handleSaveCollection = async () => {
    if (!newCollectionName.trim()) return;
    const supabase = createClient();

    if (editingCollection) {
      await supabase
        .from('collections')
        .update({ name: newCollectionName, color: newCollectionColor })
        .eq('id', editingCollection.id);
    } else {
      await supabase
        .from('collections')
        .insert({ name: newCollectionName, color: newCollectionColor });
    }
    await loadCollections();
    setCollectionModalOpen(false);
    setEditingCollection(null);
    setNewCollectionName('');
    setNewCollectionColor(COLLECTION_COLORS[0]);
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Delete this collection? Notes will not be deleted.')) return;
    const supabase = createClient();
    await supabase.from('collections').delete().eq('id', id);
    await loadCollections();
    if (selectedCollectionId === id) {
      setSelectedCollectionId(null);
      setView('all');
    }
  };

  const openEditCollection = (e: React.MouseEvent, col: Collection) => {
    e.stopPropagation();
    setEditingCollection(col);
    setNewCollectionName(col.name);
    setNewCollectionColor(col.color);
    setCollectionModalOpen(true);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <>
      <aside
        className={`
          flex flex-col h-full bg-gray-50 border-r border-gray-200
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'w-64' : 'w-0 md:w-16'}
        `}
      >
        <div className={`flex flex-col h-full min-w-0 ${sidebarOpen ? 'min-w-[256px]' : 'min-w-0 md:min-w-[64px]'}`}>
          {/* Header */}
          <div className={`flex items-center gap-3 px-4 py-5 ${sidebarOpen ? '' : 'md:justify-center'}`}>
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
              <BookOpen size={15} className="text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-lg text-gray-900 tracking-tight">
                OpenNote
              </span>
            )}
            {sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="ml-auto p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>

          {/* Expand button when collapsed */}
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="hidden md:flex mx-auto mb-2 p-2 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
              title="Expand sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}

          {/* Search */}
          {sidebarOpen && (
            <div className="px-3 mb-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full pl-8 pr-8 py-2 text-sm rounded-lg bg-white border border-gray-200 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
            <NavItem
              icon={<BookOpen size={16} />}
              label="All Notes"
              active={view === 'all'}
              onClick={() => handleNavClick('all')}
              collapsed={!sidebarOpen}
            />
            <NavItem
              icon={<Tag size={16} />}
              label="Tags"
              active={view === 'tags'}
              onClick={() => handleNavClick('tags')}
              collapsed={!sidebarOpen}
            />

            {/* Collections */}
            {sidebarOpen && (
              <div className="mt-4">
                <button
                  onClick={() => setCollectionsExpanded(!collectionsExpanded)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${collectionsExpanded ? 'rotate-90' : ''}`}
                  />
                  Collections
                  <span className="ml-auto text-gray-400 font-normal normal-case tracking-normal">
                    {collections.length}
                  </span>
                </button>

                {collectionsExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {collections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleCollectionClick(col.id)}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group
                          ${
                            view === 'collection' && selectedCollectionId === col.id
                              ? 'bg-violet-100 text-violet-700'
                              : 'text-gray-600 hover:bg-gray-100'
                          }
                        `}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <span className="flex-1 text-left truncate">{col.name}</span>
                        <button
                          onClick={(e) => openEditCollection(e, col)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all"
                        >
                          <Settings size={11} />
                        </button>
                      </button>
                    ))}

                    <button
                      onClick={() => {
                        setEditingCollection(null);
                        setNewCollectionName('');
                        setNewCollectionColor(COLLECTION_COLORS[0]);
                        setCollectionModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-violet-600 transition-all"
                    >
                      <Plus size={14} />
                      New Collection
                    </button>
                  </div>
                )}
              </div>
            )}

            {!sidebarOpen && (
              <NavItem
                icon={<FolderOpen size={16} />}
                label="Collections"
                active={view === 'collection'}
                onClick={() => handleNavClick('collection')}
                collapsed
              />
            )}
          </nav>

          {/* Footer */}
          <div className={`p-3 border-t border-gray-200 space-y-1`}>
            {sidebarOpen && userEmail && (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-violet-600" />
                </div>
                <span className="text-xs text-gray-500 truncate flex-1">{userEmail}</span>
              </div>
            )}
            <div className={`flex items-center gap-2 ${sidebarOpen ? '' : 'md:justify-center'}`}>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {sidebarOpen && (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors ml-auto"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Collection Modal */}
      {collectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4">
              {editingCollection ? 'Edit Collection' : 'New Collection'}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Collection name"
                autoFocus
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLLECTION_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCollectionColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: newCollectionColor === c ? '#7C3AED' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              {editingCollection && (
                <button
                  onClick={() => handleDeleteCollection(editingCollection.id)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => {
                  setCollectionModalOpen(false);
                  setEditingCollection(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCollection}
                disabled={!newCollectionName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                {editingCollection ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
