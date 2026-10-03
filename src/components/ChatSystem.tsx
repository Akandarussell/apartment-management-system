import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Building,
  Check,
  CheckCheck,
  Search,
  Shield,
} from 'lucide-react';
import { AppDatabaseState, ChatMessage, UserProfile } from '../types';
import { COMPLEX_CONFIG } from '../lib/complexConfig';

interface Props {
  data: AppDatabaseState;
  currentUser: UserProfile;
  onSendMessage: (recipientId: string, recipientName: string, message: string) => void;
}

export const ChatSystem: React.FC<Props> = ({
  data,
  currentUser,
  onSendMessage,
}) => {
  const [activeRecipientId, setActiveRecipientId] = useState<string>(() => {
    if (currentUser.role === 'tenant') {
      return 'user-manager-russell';
    }
    return 't-a2';
  });

  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Eligible contact list based on user role
  const getContacts = () => {
    if (currentUser.role === 'manager') {
      // Manager can chat with all tenants and owners
      return [
        ...data.profiles.filter((p) => p.id !== currentUser.id),
        ...data.tenants.map((t) => ({
          id: t.id,
          fullName: `${t.fullName} (Flat ${t.flatId})`,
          email: t.email || '',
          phone: t.phone,
          role: 'tenant' as const,
          flatId: t.flatId,
          isActive: true,
          createdAt: t.entryDate,
        })),
      ];
    } else if (currentUser.role === 'owner') {
      // Owner can chat with manager and tenants in their block
      const manager = data.profiles.find((p) => p.role === 'manager');
      const blockTenants = data.tenants
        .filter((t) => t.blockName === currentUser.assignedBlock)
        .map((t) => ({
          id: t.id,
          fullName: `${t.fullName} (Flat ${t.flatId})`,
          email: t.email || '',
          phone: t.phone,
          role: 'tenant' as const,
          flatId: t.flatId,
          isActive: true,
          createdAt: t.entryDate,
        }));
      return manager ? [manager, ...blockTenants] : blockTenants;
    } else {
      // Tenant can chat with manager and their block owner
      const manager = data.profiles.find((p) => p.role === 'manager');
      const unit = data.units.find((u) => u.flatId === currentUser.flatId);
      const owner = data.profiles.find((p) => p.assignedBlock === unit?.blockName);
      const list: UserProfile[] = [];
      if (manager) list.push(manager);
      if (owner) list.push(owner);
      return list;
    }
  };

  const contacts = getContacts().filter((c) =>
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeContact = contacts.find((c) => c.id === activeRecipientId) || contacts[0];

  // Messages between current user and active contact
  const conversationMessages = data.chatMessages.filter(
    (m) =>
      (m.senderId === currentUser.id && m.recipientId === activeRecipientId) ||
      (m.senderId === activeRecipientId && m.recipientId === currentUser.id) ||
      // Handle tenant ID mappings
      (currentUser.role === 'tenant' && m.recipientId === currentUser.flatId) ||
      (currentUser.role === 'tenant' && m.senderId === currentUser.flatId)
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeContact) return;
    onSendMessage(activeContact.id, activeContact.fullName, messageText.trim());
    setMessageText('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden h-[620px] flex flex-col md:flex-row">
      {/* Contact List Sidebar */}
      <div className="w-full md:w-80 border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-sm">Direct Messages</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real-time chat with complex management & tenants
          </p>
          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {contacts.map((contact) => {
            const isSelected = contact.id === activeRecipientId;
            return (
              <button
                key={contact.id}
                onClick={() => setActiveRecipientId(contact.id)}
                className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors cursor-pointer ${
                  isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-100/70'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-700 to-indigo-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {contact.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900 text-xs truncate">
                      {contact.fullName}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {contact.role === 'manager' ? 'Super Admin / Manager' : contact.role === 'owner' ? 'Block Owner' : 'Flat Resident'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
          <p className="font-bold text-slate-800 leading-tight">{COMPLEX_CONFIG.name}</p>
          <p className="truncate text-slate-500 mt-0.5">{COMPLEX_CONFIG.address}</p>
          <p className="text-blue-700 font-semibold mt-1">Hotline: {COMPLEX_CONFIG.contacts}</p>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col h-full bg-white">
        {/* Chat Header */}
        {activeContact ? (
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                {activeContact.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {activeContact.fullName}
                </h3>
                <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Active Now &bull; {COMPLEX_CONFIG.name}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {activeContact.role}
            </span>
          </div>
        ) : null}

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/20">
          {conversationMessages.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No messages yet in this conversation.</p>
              <p className="text-[11px] mt-1">Send a message below to start chatting.</p>
            </div>
          ) : (
            conversationMessages.map((m) => {
              const isMine = m.senderId === currentUser.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
                    }`}
                  >
                    {!isMine && (
                      <p className="text-[10px] font-bold text-blue-700 mb-0.5">
                        {m.senderName}
                      </p>
                    )}
                    <p className="leading-relaxed">{m.message}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                      <span>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMine && <CheckCheck className="w-3 h-3 text-blue-200" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
          <input
            type="text"
            placeholder="Type your message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
