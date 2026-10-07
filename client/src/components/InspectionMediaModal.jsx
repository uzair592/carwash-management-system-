import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  UploadCloud,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Maximize2,
  FileImage,
  AlertCircle,
  Loader2,
  Sparkles,
  Car,
} from 'lucide-react';
import axios from 'axios';

export default function InspectionMediaModal({ jobCard, onClose, onMediaUpdated }) {
  const [mediaList, setMediaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'BEFORE' | 'AFTER' | 'DAMAGE_PROOF'
  const [selectedImage, setSelectedImage] = useState(null); // File object for upload
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState('DAMAGE_PROOF'); // Default to Pre-existing Damage
  const [notes, setNotes] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null); // String URL for full preview
  const [toast, setToast] = useState(null);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMedia = async () => {
    if (!jobCard?.id) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/job-cards/${jobCard.id}/media`);
      if (res.data?.data) {
        setMediaList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load vehicle inspection media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [jobCard?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('type', mediaType);
      formData.append('notes', notes);

      const res = await axios.post(`/api/job-cards/${jobCard.id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showToast('success', res.data?.message || 'Inspection photo saved securely on local server!');
      setSelectedImage(null);
      setPreviewUrl(null);
      setNotes('');
      loadMedia();
      if (onMediaUpdated) onMediaUpdated();
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    if (!window.confirm('Delete this inspection photo record?')) return;
    try {
      await axios.delete(`/api/job-cards/media/${mediaId}`);
      showToast('success', 'Photo removed.');
      loadMedia();
      if (onMediaUpdated) onMediaUpdated();
    } catch (err) {
      showToast('error', err.response?.data?.message || err.message);
    }
  };

  const filteredMedia = mediaList.filter((m) => {
    if (filterType === 'ALL') return true;
    return m.type === filterType;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
                : 'bg-rose-950 border-rose-800 text-rose-200'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-semibold">{toast.text}</span>
          </div>
        )}

        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">Digital Vehicle Inspection</h3>
                <span className="font-mono text-sm font-bold bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-800">
                  {jobCard.vehicle?.registration_number}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ticket #{jobCard.ticket_number} • Pre-existing damage & after-detailing liability protection
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Form Card */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 shadow-inner">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <UploadCloud className="w-4 h-4 text-sky-400" />
              Upload Inspection Photo
            </h4>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Photo Drop Area / File Input */}
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Select Image File / Camera Capture</label>
                  <label className="border-2 border-dashed border-slate-800 hover:border-sky-500/60 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80 min-h-[140px]">
                    {previewUrl ? (
                      <div className="relative w-full h-32 flex items-center justify-center">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-h-32 rounded-lg object-contain"
                        />
                        <span className="absolute bottom-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                          Click to Change
                        </span>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-500 mb-2" />
                        <span className="text-xs font-semibold text-slate-300">Click to capture / browse photo</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, WEBP up to 15MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Metadata: Type & Notes */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Inspection Type</label>
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="DAMAGE_PROOF">⚠️ Pre-existing Damage Proof (Scratches/Dents)</option>
                      <option value="BEFORE">📸 Intake Photo (Before Wash)</option>
                      <option value="AFTER">✨ Finished Quality Inspection (After Wash/Detailing)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Observation Notes</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Scratches on left front fender, bumper scuff on passenger side..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!selectedImage || isUploading}
                  className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving locally...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" /> Save Inspection Photo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Photo Gallery & Filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  Attached Vehicle Photos ({mediaList.length})
                </h4>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filterType === 'ALL' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({mediaList.length})
                </button>
                <button
                  onClick={() => setFilterType('DAMAGE_PROOF')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filterType === 'DAMAGE_PROOF'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-amber-400/80 hover:text-amber-300'
                  }`}
                >
                  Damage Proof
                </button>
                <button
                  onClick={() => setFilterType('AFTER')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filterType === 'AFTER'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  After Wash
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-10 text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" /> Loading inspection gallery...
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="text-center py-12 bg-slate-950/40 border border-slate-800/60 rounded-2xl text-slate-500 text-xs">
                No inspection photos uploaded under this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden group flex flex-col justify-between shadow-lg"
                  >
                    <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                      <img
                        src={item.file_path}
                        alt="Vehicle Inspection"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="50%" fill="%2364748b" dominant-baseline="middle" text-anchor="middle" font-size="10">Image Error</text></svg>';
                        }}
                      />
                      <button
                        onClick={() => setLightboxImage(item.file_path)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                        title="View Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Type Badge */}
                      <span
                        className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md ${
                          item.type === 'DAMAGE_PROOF'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : item.type === 'AFTER'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-sky-950/80 text-sky-300 border border-sky-800'
                        }`}
                      >
                        {item.type === 'DAMAGE_PROOF'
                          ? 'Pre-existing Damage'
                          : item.type === 'AFTER'
                          ? 'After Detailing'
                          : 'Before Wash'}
                      </span>
                    </div>

                    <div className="p-3 text-xs flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-slate-300 line-clamp-2">
                          {item.notes || <span className="italic text-slate-500">No notes logged</span>}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono block mt-1">
                          {new Date(item.uploaded_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="pt-2 mt-2 border-t border-slate-900 flex justify-end">
                        <button
                          onClick={() => handleDeleteMedia(item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition text-[11px] flex items-center gap-1"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Fullscreen Viewer */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Full Inspection Photo"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
          />
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
