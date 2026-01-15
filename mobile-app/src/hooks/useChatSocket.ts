import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Keychain from 'react-native-keychain';
import { CHAT_WS_URL } from '../constants/config';
import { useDispatch } from 'react-redux';
import { addMessage } from '../store/slices/chatSlice';

export const useChatSocket = (conversationId: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!conversationId) return;

    const connectSocket = async () => {
      try {
        const credentials = await Keychain.getGenericPassword();
        const token = credentials?.password;

        if (!socketRef.current) {
          socketRef.current = io(CHAT_WS_URL, {
            transports: ['websocket'],
            auth: { token },
            reconnectionAttempts: 5,
          });

          socketRef.current.on('connect', () => {
            console.log('Connected to Chat WebSocket');
            socketRef.current?.emit('join:conversation', conversationId);
          });

          socketRef.current.on('disconnect', () => {
            console.log('Disconnected from Chat WebSocket');
          });

          socketRef.current.on('message:new', (message: any) => {
            dispatch(addMessage(message));
          });

          socketRef.current.on('typing', (data: any) => {
            // Handle typing indicator
            console.log('Typing:', data);
          });
        }
      } catch (error) {
        console.error('Error connecting to chat socket:', error);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave:conversation', conversationId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [conversationId, dispatch]);

  const sendMessage = (content: string) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('message:send', {
        conversationId,
        content,
      });
    }
  };

  return { sendMessage };
};


