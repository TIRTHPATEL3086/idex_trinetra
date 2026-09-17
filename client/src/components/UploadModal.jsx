import { useState } from 'react';
import { X, Upload, FileText, ShieldAlert, Check } from 'lucide-react';
import { uploadAsset } from '../lib/api.js';

export default function UploadModal({ isOpen, onClose, onUploaded }) {
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('CONFIDENTIAL');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a document title.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await uploadAsset({ file, title, classification });
      onUploaded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to upload asset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Register Protected Asset</h3>
              <p className="text-[11px] text-slate-500">Document will be AES-256-GCM encrypted and indexed.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tactical Defense Protocol Alpha-7"
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Security Classification</label>
            <div className="mt-1.5 grid grid-cols-4 gap-2 text-xs">
              {['RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP SECRET'].map((cls) => (
                <button
                  type="button"
                  key={cls}
                  onClick={() => setClassification(cls)}
                  className={`rounded border py-2 text-center font-medium transition ${
                    classification === cls
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Document / Image File</label>
            <div className="mt-1.5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-800 bg-slate-950/60 p-6 hover:border-slate-700">
              <Upload className="h-8 w-8 text-slate-500 mb-2" />
              {file ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="text-center">
                  <label className="cursor-pointer text-xs font-medium text-cyan-400 hover:text-cyan-300">
                    <span>Click to browse file</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, TIFF, or PDF (up to 25MB)</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-cyan-500 disabled:opacity-50"
            >
              {loading ? 'Encrypting & Registering…' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
