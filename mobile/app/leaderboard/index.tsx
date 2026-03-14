import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Image, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown, Trophy, Medal, Star, Shield } from 'lucide-react-native';
import { leaderboardService } from '../../lib/services/leaderboard.service';
import { useAuthStore } from '../../lib/store/auth-store';
import { SkeletonList } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { formatScore, TIER_CONFIG, scoreToTier } from '../../lib/utils/format';
import type { LeaderboardData, LeaderboardEntry } from '../../lib/types';

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={22} color="#f0b90b" fill="#f0b90b" />;
  if (rank === 2) return <Trophy size={22} color="#9ca3af" />;
  if (rank === 3) return <Medal size={22} color="#b45309" />;
  return <Text style={{ color: '#6b7280', fontWeight: '800', fontSize: 15, width: 22, textAlign: 'center' }}>{rank}</Text>;
}

function LeaderboardRow({ entry, isSelf }: { entry: LeaderboardEntry; isSelf: boolean }) {
  const tier = scoreToTier(entry.credit_score);
  const tierCfg = TIER_CONFIG[tier];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: isSelf ? 'rgba(240,185,11,0.06)' : 'transparent',
      borderBottomWidth: 1, borderBottomColor: '#1e2130',
      borderLeftWidth: isSelf ? 3 : 0, borderLeftColor: '#f0b90b',
    }}>
      <View style={{ width: 36, alignItems: 'center' }}>
        <RankIcon rank={entry.rank} />
      </View>

      {/* Avatar */}
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${tierCfg.color}25`, alignItems: 'center', justifyContent: 'center', marginLeft: 10, borderWidth: 2, borderColor: `${tierCfg.color}50` }}>
        <Text style={{ fontSize: 16 }}>{tierCfg.emoji}</Text>
      </View>

      {/* Name + tier */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: isSelf ? '#f0b90b' : 'white', fontWeight: isSelf ? '900' : '700', fontSize: 15 }}>
            {entry.username}
          </Text>
          {isSelf && <Text style={{ color: '#f0b90b', fontSize: 10, fontWeight: '700' }}>BẠN</Text>}
        </View>
        <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
          {tierCfg.label} · {entry.orders_completed} đơn hoàn thành
        </Text>
      </View>

      {/* Score */}
      <Text style={{ color: tierCfg.color, fontWeight: '800', fontSize: 16 }}>
        {entry.credit_score.toLocaleString()}
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { user } = useAuthStore();
  const [data, setData] = useState<LeaderboardData | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: res, error: err } = await leaderboardService.get(50);
    setData(res);
    if (err) setError(err);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = () => { setRefreshing(true); fetch(true); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0c0e14' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1e2130' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>🏆 Bảng Xếp Hạng</Text>
        <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
          Top {data?.total_users?.toLocaleString() ?? '—'} người dùng theo Credit Score
        </Text>
      </View>

      {/* Self Banner */}
      {data?.self_rank && (
        <View style={{ margin: 16, backgroundColor: 'rgba(240,185,11,0.08)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Star size={20} color="#f0b90b" fill="#f0b90b" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#f0b90b', fontWeight: '800' }}>Xếp hạng của bạn</Text>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>
              #{data.self_rank} / {data.total_users?.toLocaleString()} · {formatScore(data.self_score)}
            </Text>
          </View>
        </View>
      )}

      {/* Top 3 Podium */}
      {data && data.entries.length >= 3 && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          {/* 2nd */}
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 28 }}>🥈</Text>
            <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 10, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#1e2130' }}>
              <Text style={{ color: '#9ca3af', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{data.entries[1]?.username}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 11 }}>{data.entries[1]?.credit_score.toLocaleString()}</Text>
            </View>
          </View>
          {/* 1st */}
          <View style={{ flex: 1, alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 36 }}>👑</Text>
            <View style={{ backgroundColor: 'rgba(240,185,11,0.12)', borderRadius: 16, padding: 12, alignItems: 'center', width: '100%', borderWidth: 2, borderColor: 'rgba(240,185,11,0.4)' }}>
              <Text style={{ color: '#f0b90b', fontWeight: '900', fontSize: 14 }} numberOfLines={1}>{data.entries[0]?.username}</Text>
              <Text style={{ color: '#f0b90b', fontWeight: '700', fontSize: 12 }}>{data.entries[0]?.credit_score.toLocaleString()}</Text>
            </View>
          </View>
          {/* 3rd */}
          <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 28 }}>🥉</Text>
            <View style={{ backgroundColor: '#131722', borderRadius: 16, padding: 10, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: '#1e2130' }}>
              <Text style={{ color: '#b45309', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{data.entries[2]?.username}</Text>
              <Text style={{ color: '#b45309', fontSize: 11 }}>{data.entries[2]?.credit_score.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={{ padding: 16 }}><SkeletonList count={8} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={data?.entries.slice(3) ?? []}
          keyExtractor={e => String(e.user_id)}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#f0b90b" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <LeaderboardRow
              entry={item}
              isSelf={item.is_self || item.user_id === user?.user_id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
