import React, { useState } from 'react';
import '../styles/ShareModal.css';

interface ShareModalProps {
    url: string;
    title: string;
    text: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ url, title, text, onClose }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(url).catch(() => {
            const el = document.createElement('textarea');
            el.value = url; document.body.appendChild(el); el.select();
            document.execCommand('copy'); document.body.removeChild(el);
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const whatsapp = () => {
        const msg = encodeURIComponent(`${text}\n${url}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
    };

    const gmail = () => {
        const su = encodeURIComponent(title);
        const body = encodeURIComponent(`${text}\n\n${url}`);
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${su}&body=${body}`, '_blank', 'noopener');
    };

    const nativeShare = async () => {
        if (!navigator.share) return;
        try { await navigator.share({ title, text, url }); onClose(); } catch {}
    };

    return (
        <div className="share-overlay" onClick={onClose}>
            <div className="share-modal" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <span className="share-modal-title">Share</span>
                    <button className="share-close-btn" onClick={onClose}>✕</button>
                </div>
                <p className="share-url-preview">{url}</p>
                <div className="share-actions">
                    <button className="share-opt-btn copy-btn" onClick={copy}>
                        {copied ? (
                            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                        ) : (
                            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link</>
                        )}
                    </button>
                    <button className="share-opt-btn whatsapp-btn" onClick={whatsapp}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.659 1.436 5.17L2 22l4.926-1.41A9.964 9.964 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 11.999 2zm0 18a7.963 7.963 0 0 1-4.07-1.111l-.292-.174-3.012.863.846-3.033-.19-.31A7.961 7.961 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
                        WhatsApp
                    </button>
                    <button className="share-opt-btn gmail-btn" onClick={gmail}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
                        Gmail
                    </button>
                    {!!navigator.share && (
                        <button className="share-opt-btn native-btn" onClick={nativeShare}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            More
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
