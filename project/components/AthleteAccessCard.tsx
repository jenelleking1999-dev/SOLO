import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { KeyRound, Share2, UserX, X } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AthleteConnection, AthleteInvite, AthleteRelationship } from '@/types/database';
import {
  cancelInvite,
  createAthleteInvite,
  formatInviteCode,
  getAthleteConnections,
  getPendingInvites,
  removeAthleteLink,
} from '@/lib/athleteAccess';

/**
 * Coach-only: lets the athlete (or a parent) see this athlete's times in their
 * own SOLO account by sharing a one-time invite code, and shows/removes who
 * already has access.
 */
export function AthleteAccessCard({ athleteName }: { athleteName: string }) {
  const [connections, setConnections] = useState<AthleteConnection[]>([]);
  const [invites, setInvites] = useState<AthleteInvite[]>([]);
  const [creating, setCreating] = useState<AthleteRelationship | null>(null);
  const [newCode, setNewCode] = useState<{ code: string; relationship: AthleteRelationship } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AthleteConnection | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([
        getAthleteConnections(athleteName),
        getPendingInvites(athleteName),
      ]);
      setConnections(c);
      setInvites(i);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [athleteName]);

  useEffect(() => {
    load();
  }, [load]);

  const shareCode = async (code: string, relationship: AthleteRelationship) => {
    const who = relationship === 'parent' ? `${athleteName}'s parent` : athleteName;
    const message =
      `Your SOLO invite code${relationship === 'parent' ? ` to follow ${athleteName}` : ''}: ` +
      `${formatInviteCode(code)}\n\nDownload SOLO, create a ` +
      `${relationship === 'parent' ? 'Parent' : 'Athlete'} account, and enter this code on the Home screen. ` +
      `It works once and expires in 14 days.`;
    try {
      await Share.share({ message, title: `SOLO code for ${who}` });
    } catch {
      // Sharing isn't available everywhere (e.g. some browsers); the code stays on screen.
    }
  };

  const handleCreate = async (relationship: AthleteRelationship) => {
    setCreating(relationship);
    setError(null);
    try {
      const invite = await createAthleteInvite(athleteName, relationship);
      setNewCode({ code: invite.code, relationship });
      await load();
      shareCode(invite.code, relationship);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(null);
    }
  };

  const handleCancelInvite = async (invite: AthleteInvite) => {
    try {
      await cancelInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (newCode?.code === invite.code) setNewCode(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    const target = removeTarget;
    setRemoveTarget(null);
    try {
      await removeAthleteLink(target.link_id);
      setConnections((prev) => prev.filter((c) => c.link_id !== target.link_id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <KeyRound size={18} color={colors.dark.accent} />
        <Text style={styles.title}>Athlete & parent access</Text>
      </View>
      <Text style={styles.body}>
        Share a one-time code so {athleteName} or a parent can see these times in their own SOLO
        account. They can only view, never change anything.
      </Text>

      <View style={styles.buttonRow}>
        {(['athlete', 'parent'] as const).map((relationship) => (
          <TouchableOpacity
            key={relationship}
            style={styles.inviteButton}
            onPress={() => handleCreate(relationship)}
            disabled={creating !== null}
          >
            {creating === relationship ? (
              <ActivityIndicator size="small" color={colors.dark.primary} />
            ) : (
              <Text style={styles.inviteButtonText}>
                Invite {relationship === 'athlete' ? 'athlete' : 'parent'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {newCode && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>
            {newCode.relationship === 'parent' ? 'Parent' : 'Athlete'} code
          </Text>
          <Text style={styles.codeText} selectable>
            {formatInviteCode(newCode.code)}
          </Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => shareCode(newCode.code, newCode.relationship)}
          >
            <Share2 size={16} color="#ffffff" />
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {connections.length > 0 && (
        <>
          <Text style={styles.subTitle}>Has access</Text>
          {connections.map((c) => (
            <View key={c.link_id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listName}>
                  {c.viewer_name || c.viewer_email || 'SOLO user'}
                </Text>
                <Text style={styles.listSub}>
                  {c.relationship === 'parent' ? 'Parent' : 'Athlete'}
                  {c.viewer_name && c.viewer_email ? ` · ${c.viewer_email}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRemoveTarget(c)}
                style={styles.iconButton}
                accessibilityLabel="Remove access"
              >
                <UserX size={18} color={colors.dark.error} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {invites.length > 0 && (
        <>
          <Text style={styles.subTitle}>Unused codes</Text>
          {invites.map((invite) => (
            <View key={invite.id} style={styles.listRow}>
              <View style={styles.listText}>
                <Text style={styles.listCode} selectable>
                  {formatInviteCode(invite.code)}
                </Text>
                <Text style={styles.listSub}>
                  {invite.relationship === 'parent' ? 'Parent' : 'Athlete'} · expires{' '}
                  {new Date(invite.expires_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCancelInvite(invite)}
                style={styles.iconButton}
                accessibilityLabel="Cancel code"
              >
                <X size={18} color={colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <ConfirmDialog
        visible={!!removeTarget}
        title="Remove access?"
        message={
          removeTarget
            ? `${removeTarget.viewer_name || removeTarget.viewer_email || 'This account'} will no longer see ${athleteName}'s times.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.dark.cardGlass,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dark.borderLight,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text,
  },
  body: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inviteButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dark.primary,
  },
  inviteButtonText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.primary,
  },
  codeBox: {
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  codeLabel: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeText: {
    fontSize: 28,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
    color: colors.dark.text,
    letterSpacing: 4,
    marginVertical: spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dark.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  shareButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.bold,
    fontWeight: typography.fontWeight.bold,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.error,
    marginTop: spacing.sm,
  },
  subTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.borderLight,
  },
  listText: {
    flex: 1,
  },
  listName: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.dark.text,
  },
  listCode: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.semibold,
    color: colors.dark.text,
    letterSpacing: 2,
  },
  listSub: {
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.dark.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    padding: spacing.sm,
  },
});
