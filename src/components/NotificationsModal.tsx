import React, { useEffect } from 'react';
import { X, Bell, CheckCircle2, Clock, Sparkles, Coins, AlertCircle } from 'lucide-react';
import { useTranslation } from '../locales/TranslationContext';
import { AppNotification } from '../types';

interface NotificationsModalProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onClose,
  onMarkAllRead,
}) => {
  const { t, language } = useTranslation();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_verified':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'draw_won':
        return <Sparkles className="w-4 h-4 text-[#7856FF]" />;
      case 'payout_processed':
        return <Coins className="w-4 h-4 text-emerald-600" />;
      case 'reminder':
        return <Clock className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-[#7856FF]" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1132]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white max-w-md w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-[#E6E1F5] relative text-gray-900 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Fixed */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[#E6E1F5] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7856FF] text-white flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1C1132]">
                {t.notifications}
              </h2>
              <p className="text-[11px] text-gray-500">Activity and payout alerts</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-[10px] font-bold uppercase tracking-wider text-[#7856FF] hover:underline px-2 py-1 bg-[#F8F7FC] hover:bg-[#EBE7FA] rounded-lg transition-colors border border-[#E6E1F5]"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-[#F8F7FC] rounded-xl transition-colors border border-transparent hover:border-[#E6E1F5]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Notifications Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 sm:px-6 sm:py-5 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center mx-auto">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-xs text-gray-500">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 border rounded-xl text-xs transition-all ${
                  n.read ? 'bg-white border-[#E6E1F5] text-gray-700' : 'bg-[#F8F7FC] border-[#7856FF]/30 text-gray-900 shadow-xs'
                }`}
              >
                <div className="flex items-start space-x-2.5">
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1">
                    <p className="font-bold text-[#1C1132]">{n.title}</p>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                      {n.createdAt.replace('T', ' ').substring(0, 16)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#F8F7FC] border-t border-[#E6E1F5] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-white rounded-xl border border-gray-200 transition-all uppercase tracking-wider"
          >
            {t.cancel || 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};

