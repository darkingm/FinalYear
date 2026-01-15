import { createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../../api/client';
import { chatEndpoints } from '../../api/endpoints';
import {
  setConversations,
  setCurrentConversation,
  setMessages,
  addMessage,
  setUnreadCount,
  setLoading,
  setError,
} from '../slices/chatSlice';

export const fetchConversationsAsync = createAsyncThunk(
  'chat/fetchConversations',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(chatEndpoints.conversations);
      
      if (response.data.success) {
        const conversations = response.data.data.conversations || response.data.data || [];
        dispatch(setConversations(conversations));
        dispatch(setLoading(false));
        return conversations;
      }
      
      throw new Error('Failed to fetch conversations');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch conversations'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch conversations');
    }
  }
);

export const fetchMessagesAsync = createAsyncThunk(
  'chat/fetchMessages',
  async (conversationId: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      const response = await apiClient.get(chatEndpoints.messages(conversationId));
      
      if (response.data.success) {
        const messages = response.data.data.messages || response.data.data || [];
        dispatch(setMessages(messages));
        dispatch(setLoading(false));
        return messages;
      }
      
      throw new Error('Failed to fetch messages');
    } catch (error: any) {
      dispatch(setLoading(false));
      dispatch(setError(error.response?.data?.error || 'Failed to fetch messages'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch messages');
    }
  }
);

export const sendMessageAsync = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, content }: { conversationId: string; content: string }, { dispatch, rejectWithValue }) => {
    try {
      // Note: This would typically be handled via WebSocket, but keeping for fallback
      const response = await apiClient.post(chatEndpoints.messages(conversationId), {
        content,
      });
      
      if (response.data.success) {
        const message = response.data.data.message || response.data.data;
        dispatch(addMessage(message));
        return message;
      }
      
      throw new Error('Failed to send message');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to send message'));
      return rejectWithValue(error.response?.data?.error || 'Failed to send message');
    }
  }
);

export const fetchUnreadCountAsync = createAsyncThunk(
  'chat/fetchUnreadCount',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiClient.get(chatEndpoints.unreadCount);
      
      if (response.data.success) {
        const count = response.data.data.count || 0;
        dispatch(setUnreadCount(count));
        return count;
      }
      
      throw new Error('Failed to fetch unread count');
    } catch (error: any) {
      dispatch(setError(error.response?.data?.error || 'Failed to fetch unread count'));
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch unread count');
    }
  }
);


