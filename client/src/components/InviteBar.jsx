import { useState } from 'react';

export default function InviteBar({ roomId }) {
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}/room/${roomId}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:block text-xs text-gray-500 font-mono bg-gray-100 border border-gray-200 px-2 py-1 rounded max-w-xs truncate">
        {url}
      </span>
      <button
        onClick={handleCopy}
        title="Copy invite link"
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-all duration-150"
        style={{
          background: copied ? '#d1fae5' : '#f3f4f6',
          borderColor: copied ? '#6ee7b7' : '#d1d5db',
          color: copied ? '#065f46' : '#374151',
        }}
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15 3.293 9.879a1 1 0 111.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            Invite
          </>
        )}
      </button>
    </div>
  );
}
