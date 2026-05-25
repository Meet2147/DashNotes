'use client';

import React, { useState } from 'react';
import {
  StickyNote,
  Search,
  Calendar,
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
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useCollections } from '@/hooks/useNotes';
import CollectionModal from './CollectionModal';
import { Collection } from '@/lib/db';

export default function Sidebar() {
  const {
    view,
    setView,
    darkMode,
    toggleDarkMode,
    searchQuery,
    setSearchQuery,
    selectedCollectionId,
    setSelectedCollectionId,
    setSelectedNoteId,
    sidebarOpen,
    toggleSidebar,
    setMobilePanel,
    setCalendarSelectedDate,
  } = useAppStore();

  const collections = useCollections();
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);

  const handleNavClick = (v: typeof view) => {
    setView(v);
    if (v !== 'collection') setSelectedCollectionId(null);
    if (v !== 'calendar') setCalendarSelectedDate(null);
    setSelectedNoteId(null);
    setMobilePanel('notes');
  };

  const handleCollectionClick = (id: number) => {
    setView('collection');
    setSelectedCollectionId(id);
    setSelectedNoteId(null);
    setMobilePanel('notes');
  };

  const handleEditCollection = (e: React.MouseEvent, col: Collection) => {
    e.stopPropagation();
    setEditingCollection(col);
    setCollectionModalOpen(true);
  };

  const handleNewCollection = () => {
    setEditingCollection(null);
    setCollectionModalOpen(true);
  };

  return (
    <>
      <aside
        className={`
          flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
          transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen ? 'w-64' : 'w-0 md:w-16'}
        `}
      >
        <div className={`flex flex-col h-full min-w-0 ${sidebarOpen ? 'min-w-[256px]' : 'min-w-0 md:min-w-[64px]'}`}>
          {/* Header */}
          <div className={`flex items-center gap-3 px-4 py-5 ${sidebarOpen ? '' : 'md:justify-center'}`}>
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
              <StickyNote size={16} className="text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-lg text-gray-900 dark:text-gray-100 tracking-tight">
                DashNotes
              </span>
            )}
            {sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="ml-auto p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
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
              className="hidden md:flex mx-auto mb-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
              title="Expand sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}

          {/* Search */}
          {sidebarOpen && (
            <div className="px-3 mb-4">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="w-full pl-8 pr-8 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
            {/* All Notes */}
            <NavItem
              icon={<StickyNote size={16} />}
              label="All Notes"
              active={view === 'all'}
              onClick={() => handleNavClick('all')}
              collapsed={!sidebarOpen}
            />

            {/* Calendar */}
            <NavItem
              icon={<Calendar size={16} />}
              label="Calendar"
              active={view === 'calendar'}
              onClick={() => handleNavClick('calendar')}
              collapsed={!sidebarOpen}
            />

            {/* Tags */}
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
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${collectionsExpanded ? 'rotate-90' : ''}`}
                  />
                  Collections
                  <span className="ml-auto text-gray-400 dark:text-gray-500 font-normal normal-case tracking-normal">
                    {collections.length}
                  </span>
                </button>

                {collectionsExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {collections.map((col) => (
                      <button
                        key={col.id}
                        onClick={() => handleCollectionClick(col.id!)}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group
                          ${
                            view === 'collection' && selectedCollectionId === col.id
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: col.color }}
                        />
                        <span className="flex-1 text-left truncate">{col.name}</span>
                        <button
                          onClick={(e) => handleEditCollection(e, col)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                          <Settings size={11} />
                        </button>
                      </button>
                    ))}

                    <button
                      onClick={handleNewCollection}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
                    >
                      <Plus size={14} />
                      New Collection
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Collapsed collections icon */}
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
          <div className={`p-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 ${sidebarOpen ? '' : 'md:justify-center'}`}>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {sidebarOpen && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {darkMode ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </div>
        </div>
      </aside>

      <CollectionModal
        isOpen={collectionModalOpen}
        onClose={() => {
          setCollectionModalOpen(false);
          setEditingCollection(null);
        }}
        collection={editingCollection}
      />
    </>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

function NavItem({ icon, label, active, onClick, collapsed }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${collapsed ? 'justify-center' : ''}
        ${
          active
            ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }
      `}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
