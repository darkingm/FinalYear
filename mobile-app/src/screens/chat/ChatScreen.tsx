import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState, AppDispatch } from '../../store/store';
import { fetchConversationsAsync } from '../../store/thunks/chatThunks';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { conversations, loading, unreadCount } = useSelector((state: RootState) => state.chat);

  useEffect(() => {
    dispatch(fetchConversationsAsync());
  }, [dispatch]);

  const handleConversationPress = (conversationId: string) => {
    navigation.navigate('ChatDetail' as never, { conversationId } as never);
  };

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => handleConversationPress(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.conversationInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.participants?.[0]?.name?.[0] || 'U'}
          </Text>
        </View>
        <View style={styles.conversationDetails}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.participants?.[0]?.name || 'User'}
          </Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage?.content || 'No messages yet'}
          </Text>
        </View>
      </View>
      <View style={styles.conversationMeta}>
        <Text style={styles.timestamp}>
          {item.lastMessage
            ? new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </Text>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.lg,
  },
  conversationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.light.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  conversationInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  conversationDetails: {
    flex: 1,
  },
  conversationName: {
    ...typography.body,
    color: colors.light.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  lastMessage: {
    ...typography.bodySmall,
    color: colors.light.textSecondary,
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  timestamp: {
    ...typography.caption,
    color: colors.light.textSecondary,
    marginBottom: spacing.xs,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.light.textSecondary,
  },
});

export default ChatScreen;


