import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { toTripColor, type TripColor } from '@/theme/tokens';
import { supabase } from './supabase';
import { appLink } from './trips';

export const MAX_GROUP_NAME = 40;

export type GroupRole = 'admin' | 'member';

export type Group = {
  id: string;
  name: string;
  color: TripColor;
  invite_code: string;
  created_at: string;
};

export type GroupPerson = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_color: TripColor | null;
};

export type GroupMember = GroupPerson & { role: GroupRole; joined_at: string };

/** Someone an admin has invited who hasn't answered yet. */
export type PendingMember = GroupPerson & { invited_at: string };

/** A group I'm in, with the numbers and faces its card needs. */
export type GroupCard = Group & {
  members: number;
  trips: number;
  myRole: GroupRole;
  /** The first few members, for the face stack. */
  faces: GroupPerson[];
  /** Joined within the last day, by link or by accepting an invite. */
  justJoined: boolean;
};

/** An invite waiting on me: who asked, and which group. */
export type GroupInvite = {
  group_id: string;
  group_name: string;
  group_color: TripColor;
  members: number;
  from: string;
  created_at: string;
};

export type GroupDetail = Group & {
  members: GroupMember[];
  pending: PendingMember[];
  trips: number;
  myRole: GroupRole | null;
};

/** Someone I already share a trip or group with, and where from. */
export type KnownPerson = GroupPerson & { source: string | null };

type ProfileEmbed = { display_name: string; avatar_url: string | null; avatar_color: string | null } | null;

const JUST_JOINED_MS = 24 * 60 * 60 * 1000;
const GROUP_COLUMNS = 'id, name, color, invite_code, created_at';

function person(user_id: string, p: ProfileEmbed): GroupPerson {
  return {
    user_id,
    display_name: p?.display_name ?? 'Someone',
    avatar_url: p?.avatar_url ?? null,
    avatar_color: p?.avatar_color ? toTripColor(p.avatar_color) : null,
  };
}

/** The one or two-letter mark on a group tile: initials of the first two words, else the first two letters. */
export function groupMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0].charAt(0) + words[1].charAt(0) : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** "6 people" for the card and the details header. */
export function peopleCount(n: number) {
  return n === 1 ? '1 person' : `${n} people`;
}

/** The sub-line under a group's name: size, and how many trips it has had. */
export function groupSub(members: number, trips: number) {
  const tripsText = trips === 0 ? 'nothing planned yet' : trips === 1 ? '1 trip together' : `${trips} trips together`;
  return `${peopleCount(members)} · ${tripsText}`;
}

/** "2 invites · 4 groups", the line over the Groups title. */
export function groupsSummary(invites: number, groups: number) {
  const g = groups === 1 ? '1 group' : `${groups} groups`;
  if (invites === 0) return g;
  return `${invites === 1 ? '1 invite' : `${invites} invites`} · ${g}`;
}

/** The text the join link flow shares. */
export function groupInviteLink(code: string) {
  return appLink(`group-invite/${encodeURIComponent(code)}`);
}

function friendly(error: { message: string } | null, fallback: string): Error {
  if (!error) return new Error(fallback);
  if (/make someone else an admin/i.test(error.message)) return new Error('Make someone else an admin first.');
  if (/does not match/i.test(error.message)) return new Error("That code doesn't match a group.");
  if (/no longer there/i.test(error.message)) return new Error('That invite is no longer there.');
  return new Error(fallback);
}

/** Creates a group (I become its admin) and invites the people I picked. Returns the group id. */
export async function createGroup(name: string, color: TripColor, userIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('create_group', { group_name: name, group_color: color, user_ids: userIds });
  if (error) throw friendly(error, "Couldn't create the group. Check your connection and try again.");
  return data as string;
}

export async function inviteToGroup(groupId: string, userIds: string[]) {
  const { error } = await supabase.rpc('invite_to_group', { g: groupId, user_ids: userIds });
  if (error) throw friendly(error, "Couldn't send the invite. Check your connection and try again.");
}

export async function acceptGroupInvite(groupId: string) {
  const { error } = await supabase.rpc('accept_group_invite', { g: groupId });
  if (error) throw friendly(error, "Couldn't join the group. Check your connection and try again.");
}

/** Declines my own invite, or (as an admin) cancels someone else's. */
export async function removeGroupInvite(groupId: string, userId: string) {
  const { error } = await supabase.from('group_invites').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw friendly(error, "Couldn't remove the invite. Check your connection and try again.");
}

/** Joins a group with its invite code (the join link) and returns the group id. */
export async function joinGroup(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group', { code });
  if (error) throw friendly(error, "Couldn't join the group. Check your connection and try again.");
  return data as string;
}

export async function updateGroup(id: string, patch: Partial<{ name: string; color: TripColor }>) {
  const { error } = await supabase.from('groups').update(patch).eq('id', id);
  if (error) throw friendly(error, "Couldn't save the group. Check your connection and try again.");
}

export async function setGroupRole(groupId: string, userId: string, role: GroupRole) {
  const { error } = await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId);
  if (error) throw friendly(error, "Couldn't change their role. Check your connection and try again.");
}

/** Removes a member (admins), or leaves the group when `userId` is me. */
export async function removeGroupMember(groupId: string, userId: string) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw friendly(error, "Couldn't do that. Check your connection and try again.");
}

export type GroupInvitePreview = { name: string; color: TripColor; members: number };

/** What a signed-out visitor may see about the group behind a join link; null if the code matches nothing. */
export async function groupInvitePreview(code: string): Promise<GroupInvitePreview | null> {
  const { data, error } = await supabase.rpc('group_invite_preview', { code });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { name: string; color: string; members: number } | undefined;
  return row ? { ...row, color: toTripColor(row.color) } : null;
}

type SummaryRow = { group_id: string; members: number; trips: number; my_role: GroupRole };
type MemberRow = { group_id: string; user_id: string; role: GroupRole; joined_at: string; profiles: ProfileEmbed };
type InviteRow = { group_id: string; group_name: string; group_color: string; members: number; from_name: string; created_at: string };

/** My groups and the invites waiting on me. Callers trigger `refresh` (e.g. on focus and on live changes). */
export function useGroups(myId: string | undefined) {
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [groupsRes, summaryRes, membersRes, inviteRes] = await Promise.all([
      supabase.from('groups').select(GROUP_COLUMNS).order('created_at', { ascending: false }),
      supabase.rpc('group_summaries'),
      supabase.from('group_members').select('group_id, user_id, role, joined_at, profiles(display_name, avatar_url, avatar_color)').order('joined_at'),
      supabase.rpc('my_group_invites'),
    ]);
    const failed = groupsRes.error ?? summaryRes.error ?? membersRes.error ?? inviteRes.error;
    setError(failed ? "Couldn't load your groups. Check your connection and try again." : null);
    if (!failed) {
      const summaries = new Map(((summaryRes.data ?? []) as SummaryRow[]).map((s) => [s.group_id, s]));
      const members = (membersRes.data ?? []) as unknown as MemberRow[];
      const byGroup = new Map<string, MemberRow[]>();
      for (const m of members) byGroup.set(m.group_id, [...(byGroup.get(m.group_id) ?? []), m]);
      const now = Date.now();
      // Only groups I'm in: a group I'm merely invited to is readable too, but belongs under "Waiting on you".
      const mine = ((groupsRes.data ?? []) as Group[]).filter((g) => summaries.has(g.id));
      setGroups(
        mine.map((g) => {
          const s = summaries.get(g.id)!;
          const rows = byGroup.get(g.id) ?? [];
          const me = rows.find((r) => r.user_id === myId);
          return {
            ...g,
            color: toTripColor(g.color),
            members: Number(s.members),
            trips: Number(s.trips),
            myRole: s.my_role,
            faces: rows.slice(0, 4).map((r) => person(r.user_id, r.profiles)),
            justJoined: !!me && rows.length > 1 && now - new Date(me.joined_at).getTime() < JUST_JOINED_MS,
          };
        }),
      );
      setInvites(
        ((inviteRes.data ?? []) as InviteRow[]).map((i) => ({
          group_id: i.group_id,
          group_name: i.group_name,
          group_color: toTripColor(i.group_color),
          members: Number(i.members),
          from: i.from_name,
          created_at: i.created_at,
        })),
      );
    }
    setLoading(false);
  }, [myId]);

  return { groups, invites, loading, error, refresh };
}

type DetailMemberRow = { user_id: string; role: GroupRole; joined_at: string; profiles: ProfileEmbed };
type DetailInviteRow = { user_id: string; created_at: string; profiles: ProfileEmbed };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One group with its members and pending invites. `group` is null when it's missing or I'm not in it. */
export function useGroup(id: string | undefined, myId: string | undefined) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id || !UUID.test(id)) {
      setGroup(null);
      setError(null);
      setLoading(false);
      return;
    }
    const [groupRes, membersRes, invitesRes, summaryRes] = await Promise.all([
      supabase.from('groups').select(GROUP_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('group_members').select('user_id, role, joined_at, profiles(display_name, avatar_url, avatar_color)').eq('group_id', id).order('joined_at'),
      supabase.from('group_invites').select('user_id, created_at, profiles!group_invites_user_id_fkey(display_name, avatar_url, avatar_color)').eq('group_id', id).order('created_at'),
      supabase.rpc('group_summaries'),
    ]);
    const failed = groupRes.error ?? membersRes.error ?? invitesRes.error ?? summaryRes.error;
    setError(failed ? "Couldn't load this group. Check your connection and try again." : null);
    if (!failed) {
      const members = ((membersRes.data ?? []) as unknown as DetailMemberRow[]).map((m) => ({
        ...person(m.user_id, m.profiles),
        role: m.role,
        joined_at: m.joined_at,
      }));
      // Admins first, then by when they joined.
      members.sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin'));
      const mine = members.find((m) => m.user_id === myId);
      const summary = ((summaryRes.data ?? []) as SummaryRow[]).find((s) => s.group_id === id);
      if (!groupRes.data || !mine) {
        // Missing, or RLS hid it, or I only hold an invite.
        setGroup(null);
      } else {
        setGroup({
          ...(groupRes.data as Group),
          color: toTripColor((groupRes.data as Group).color),
          members,
          pending: ((invitesRes.data ?? []) as unknown as DetailInviteRow[]).map((i) => ({ ...person(i.user_id, i.profiles), invited_at: i.created_at })),
          trips: Number(summary?.trips ?? 0),
          myRole: mine.role,
        });
      }
    }
    setLoading(false);
  }, [id, myId]);

  return { group, loading, error, refresh };
}

type KnownRow = { user_id: string; display_name: string; avatar_url: string | null; avatar_color: string | null; source: string | null };

/** People I already share a trip or group with: the only people I can invite. */
export function useKnownPeople() {
  const [people, setPeople] = useState<KnownPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('known_people');
    setError(error ? "Couldn't load your people. Check your connection and try again." : null);
    if (!error) {
      setPeople(
        ((data ?? []) as KnownRow[]).map((r) => ({
          user_id: r.user_id,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          avatar_color: r.avatar_color ? toTripColor(r.avatar_color) : null,
          source: r.source,
        })),
      );
    }
    setLoading(false);
  }, []);

  return { people, loading, error, refresh };
}

/** How many group invites are waiting on me, for the tab badge. */
export function useGroupInviteCount(myId: string | undefined, refreshKey?: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!myId) return;
    let live = true;
    supabase
      .from('group_invites')
      .select('group_id', { count: 'exact', head: true })
      .eq('user_id', myId)
      .then(({ count: n, error }) => {
        if (live && !error) setCount(n ?? 0);
      });
    return () => {
      live = false;
    };
  }, [myId, refreshKey]);
  return myId ? count : 0;
}

let liveInstances = 0;

/**
 * Calls `onChange` shortly after anything changes in my groups, members or invites. Events are only a
 * "something changed" signal; the caller reloads. Also reloads after a dropped connection returns and when
 * the app comes back to the foreground. Row-level security decides which events I'm sent.
 */
export function useGroupsLive(enabled: boolean, onChange: () => void) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), 250);
    };
    const channel = supabase.channel(`groups:${++liveInstances}`);
    for (const table of ['groups', 'group_members', 'group_invites'] as const) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, fire);
    }
    let wasDown = false;
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (wasDown) fire();
        wasDown = false;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        wasDown = true;
      }
    });
    const appState = Platform.OS === 'web' ? null : AppState.addEventListener('change', (s) => s === 'active' && fire());
    return () => {
      clearTimeout(timer);
      appState?.remove();
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
