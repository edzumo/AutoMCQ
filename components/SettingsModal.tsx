import React, { useState, useEffect } from 'react';
import { supabaseManager } from '../services/supabaseClient';
import { X, Database, Check, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      const storedUrl = localStorage.getItem('sb_url');
      const storedKey = localStorage.getItem('sb_key');
      if (storedUrl) setUrl(storedUrl);
      if (storedKey) setKey(storedKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!url || !key) {
      setStatus('error');
      return;
    }

    const success = supabaseManager.connect(url, key);
    if (success) {
      setStatus('success');
      setTimeout(() => {
        onConfigSaved();
        onClose();
      }, 1000);
    } else {
      setStatus('error');
    }
  };

  const handleDisconnect = () => {
      supabaseManager.disconnect();
      setUrl('');
      setKey('');
      setStatus('idle');
      onConfigSaved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 text-gray-900">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Database size={18} /> Database Configuration
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
            Connect to your <strong>Supabase</strong> project to enable Auto-Save and History.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Project URL</label>
            <input 
              type="text" 
              placeholder="https://xyz.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Anon / Public Key</label>
            <input 
              type="password" 
              placeholder="Key..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
            />
          </div>

          {status === 'error' && (
             <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={16} /> Invalid configuration or missing fields.
             </div>
          )}

          {status === 'success' && (
             <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check size={16} /> Connected successfully!
             </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between">
           <button 
             onClick={handleDisconnect}
             className="text-red-600 text-sm hover:underline px-2"
           >
             Disconnect
           </button>
           <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg text-sm">
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 text-sm"
            >
                Connect Database
            </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
