import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import axios from '../../api/axios';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Ticket {
  id: string;
  userId: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  lastMessage?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export default function SupportDashboard() {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('OPEN');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
    }
  }, [selectedTicket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = filter !== 'ALL' ? { status: filter } : {};
      const response = await axios.get('/api/v1/support/tickets', { params });
      setTickets(response.data.data.tickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const response = await axios.get(`/api/v1/support/tickets/${ticketId}/messages`);
      setMessages(response.data.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      await axios.post(`/api/v1/support/tickets/${selectedTicket.id}/messages`, {
        content: newMessage,
      });
      setNewMessage('');
      fetchMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;

    try {
      await axios.put(`/api/v1/support/tickets/${selectedTicket.id}/status`, { status });
      alert(t('support.statusUpdated'));
      setSelectedTicket({ ...selectedTicket, status: status as any });
      fetchTickets();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'IN_PROGRESS':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('support.dashboard')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('support.manageTickets')}
          </p>
        </div>

        {/* Filters */}
        <div className="flex space-x-4 mb-6">
          {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t(`support.${status.toLowerCase()}`)}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tickets List */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <TicketIcon className="w-5 h-5 mr-2" />
                {t('support.tickets')} ({tickets.length})
              </h2>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              {tickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition ${
                    selectedTicket?.id === ticket.id
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {ticket.subject}
                      </h3>
                      {ticket.lastMessage && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {ticket.lastMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                </motion.div>
              ))}
              {tickets.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {t('support.noTickets')}
                </div>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col">
            {selectedTicket ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedTicket.subject}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ticket #{selectedTicket.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateStatus('IN_PROGRESS')}
                        className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <ClockIcon className="w-4 h-4 inline mr-1" />
                        {t('support.inProgress')}
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('RESOLVED')}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                        {t('support.resolve')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${
                        message.senderId === 'support' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.senderId === 'support'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <p className="text-xs opacity-75 mb-1">{message.senderName}</p>
                        <p className="text-sm">{message.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={t('support.typeMessage')}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>{t('support.selectTicket')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

