import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import icon from "../assets/icon.png";
import { API_URL } from './backendurl.tsx';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    verifyTokenAndLoadData();
  }, []);

  const verifyTokenAndLoadData = async () => {
    const token = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/signin');
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
      await loadNotes(token);
    } catch (error) {
      console.error('Failed to load data:', error);
      navigate('/signin');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async (token: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotes(response.data.notes || []);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) {
      alert('Please enter a note title');
      return;
    }

    setIsCreatingNote(true);
    const token = localStorage.getItem('authToken');

    try {
      const response = await axios.post(
        `${API_URL}/api/notes`,
        {
          title: newNoteTitle.trim(),
          content: newNoteContent.trim()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setNotes([response.data.note, ...notes]);
      setShowCreateModal(false);
      setNewNoteTitle('');
      setNewNoteContent('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create note');
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    const token = localStorage.getItem('authToken');

    try {
      await axios.delete(`${API_URL}/api/notes/${noteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNotes(notes.filter(note => note.id !== noteId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete note');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/signin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3">
              <img src={icon} alt="Logo" className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">HD</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm sm:text-base transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome, {user?.name} !
          </h2>
          <p className="text-gray-600">Email: {user?.email}</p>
        </div>

        {/* Create Note Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg transition-colors shadow-sm mb-6"
        >
          Create Note
        </button>

        {/* Notes Section */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Notes</h3>
        </div>

        {notes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No notes yet. Create your first note!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <h4 className="text-lg font-semibold text-gray-900 truncate">
                    {note.title}
                  </h4>
                  {note.content && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {note.content}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors p-2"
                  aria-label="Delete note"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Note</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="noteTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  id="noteTitle"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Enter note title"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="noteContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Content (Optional)
                </label>
                <textarea
                  id="noteContent"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Enter note content"
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                  disabled={isCreatingNote}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNote}
                  disabled={isCreatingNote}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:bg-blue-400 flex items-center justify-center"
                >
                  {isCreatingNote ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-5 w-5" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-5 w-5" />
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;