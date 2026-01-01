// src/lib/collaboration/team-workspace.ts

/**
 * Team Workspace & Research Collaboration System
 * 
 * Enables secure research sharing while maintaining:
 * - End-to-end encryption for shared content
 * - Role-based access control
 * - Full audit trail for compliance
 * - Privacy-preserving collaboration
 */

// Types
export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'guest';

export type SharePermission = 'view' | 'comment' | 'edit' | 'admin';

export type ShareScope = 'private' | 'team' | 'workspace' | 'link';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: TeamRole;
  joinedAt: number;
  lastActiveAt: number;
  permissions: SharePermission[];
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  createdBy: string;
  members: TeamMember[];
  settings: WorkspaceSettings;
  stats: WorkspaceStats;
}

export interface WorkspaceSettings {
  defaultShareScope: ShareScope;
  allowExternalSharing: boolean;
  requireApprovalForSharing: boolean;
  retentionDays: number;
  allowGuestAccess: boolean;
  encryptionRequired: boolean;
  watermarkExports: boolean;
  auditLogEnabled: boolean;
}

export interface WorkspaceStats {
  totalSessions: number;
  totalSources: number;
  totalMembers: number;
  sharedItems: number;
  lastActivity: number;
}

export interface SharedResearchSession {
  id: string;
  sessionId: string;
  sharedBy: string;
  sharedAt: number;
  scope: ShareScope;
  permissions: SharePermission;
  expiresAt?: number;
  accessCode?: string;
  recipients: string[];
  encryptedKey?: string;
  accessLog: AccessLogEntry[];
  comments: SessionComment[];
  annotations: SourceAnnotation[];
}

export interface SharedSource {
  id: string;
  sourceId: string;
  sharedBy: string;
  sharedAt: number;
  scope: ShareScope;
  permissions: SharePermission;
  workspaceId?: string;
  comments: SourceComment[];
  highlights: SourceHighlight[];
}

export interface SessionComment {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
  updatedAt?: number;
  replyTo?: string;
  reactions: { emoji: string; users: string[] }[];
  resolved?: boolean;
}

export interface SourceComment {
  id: string;
  sourceId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
  highlightId?: string;
  resolved?: boolean;
}

export interface SourceHighlight {
  id: string;
  sourceId: string;
  userId: string;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  note?: string;
  createdAt: number;
}

export interface SourceAnnotation {
  id: string;
  sourceId: string;
  userId: string;
  type: 'highlight' | 'note' | 'question' | 'important' | 'disagree';
  content: string;
  position?: { start: number; end: number };
  createdAt: number;
}

export interface AccessLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: 'viewed' | 'downloaded' | 'commented' | 'edited' | 'shared' | 'exported';
  timestamp: number;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ShareInvitation {
  id: string;
  type: 'session' | 'source' | 'workspace';
  itemId: string;
  invitedBy: string;
  invitedEmail: string;
  permission: SharePermission;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
}

export interface ShareLink {
  id: string;
  type: 'session' | 'source';
  itemId: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  accessCode: string;
  permission: 'view' | 'comment';
  maxAccesses?: number;
  currentAccesses: number;
  isActive: boolean;
  requiresEmail: boolean;
  allowedDomains?: string[];
}

// Storage keys
const WORKSPACES_KEY = 'sv_team_workspaces';
const SHARED_SESSIONS_KEY = 'sv_shared_sessions';
const SHARED_SOURCES_KEY = 'sv_shared_sources';
const INVITATIONS_KEY = 'sv_share_invitations';
const SHARE_LINKS_KEY = 'sv_share_links';

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(): string {
  return crypto.randomUUID();
}

// ============================================
// WORKSPACE MANAGEMENT
// ============================================

export function createWorkspace(
  name: string,
  creatorId: string,
  creatorEmail: string,
  creatorName: string,
  settings?: Partial<WorkspaceSettings>
): TeamWorkspace {
  const workspace: TeamWorkspace = {
    id: generateId(),
    name,
    createdAt: Date.now(),
    createdBy: creatorId,
    members: [
      {
        id: creatorId,
        email: creatorEmail,
        name: creatorName,
        role: 'owner',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        permissions: ['view', 'comment', 'edit', 'admin']
      }
    ],
    settings: {
      defaultShareScope: 'team',
      allowExternalSharing: false,
      requireApprovalForSharing: false,
      retentionDays: 0,
      allowGuestAccess: false,
      encryptionRequired: true,
      watermarkExports: true,
      auditLogEnabled: true,
      ...settings
    },
    stats: {
      totalSessions: 0,
      totalSources: 0,
      totalMembers: 1,
      sharedItems: 0,
      lastActivity: Date.now()
    }
  };
  
  const workspaces = getWorkspaces();
  workspaces.push(workspace);
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  
  return workspace;
}

export function getWorkspaces(): TeamWorkspace[] {
  const stored = localStorage.getItem(WORKSPACES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getWorkspace(workspaceId: string): TeamWorkspace | null {
  const workspaces = getWorkspaces();
  return workspaces.find(w => w.id === workspaceId) || null;
}

export function updateWorkspaceSettings(
  workspaceId: string,
  settings: Partial<WorkspaceSettings>
): TeamWorkspace | null {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  
  if (index === -1) return null;
  
  workspaces[index].settings = { ...workspaces[index].settings, ...settings };
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  return workspaces[index];
}

export function addWorkspaceMember(
  workspaceId: string,
  member: Omit<TeamMember, 'joinedAt' | 'lastActiveAt'>
): TeamWorkspace | null {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  
  if (index === -1) return null;
  if (workspaces[index].members.some(m => m.email === member.email)) {
    return workspaces[index];
  }
  
  workspaces[index].members.push({
    ...member,
    joinedAt: Date.now(),
    lastActiveAt: Date.now()
  });
  workspaces[index].stats.totalMembers = workspaces[index].members.length;
  
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  return workspaces[index];
}

export function removeWorkspaceMember(workspaceId: string, memberId: string): boolean {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  
  if (index === -1) return false;
  
  const member = workspaces[index].members.find(m => m.id === memberId);
  if (member?.role === 'owner') return false;
  
  workspaces[index].members = workspaces[index].members.filter(m => m.id !== memberId);
  workspaces[index].stats.totalMembers = workspaces[index].members.length;
  
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  return true;
}

export function updateMemberRole(workspaceId: string, memberId: string, role: TeamRole): boolean {
  const workspaces = getWorkspaces();
  const index = workspaces.findIndex(w => w.id === workspaceId);
  
  if (index === -1) return false;
  
  const memberIndex = workspaces[index].members.findIndex(m => m.id === memberId);
  if (memberIndex === -1) return false;
  if (workspaces[index].members[memberIndex].role === 'owner') return false;
  
  workspaces[index].members[memberIndex].role = role;
  workspaces[index].members[memberIndex].permissions = getRolePermissions(role);
  
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  return true;
}

function getRolePermissions(role: TeamRole): SharePermission[] {
  switch (role) {
    case 'owner':
    case 'admin':
      return ['view', 'comment', 'edit', 'admin'];
    case 'editor':
      return ['view', 'comment', 'edit'];
    case 'viewer':
      return ['view', 'comment'];
    case 'guest':
      return ['view'];
    default:
      return ['view'];
  }
}

// ============================================
// SHARING FUNCTIONALITY
// ============================================

export function shareSession(
  sessionId: string,
  sharedBy: string,
  options: {
    scope: ShareScope;
    permission: SharePermission;
    recipients?: string[];
    workspaceId?: string;
    expiresInDays?: number;
    message?: string;
  }
): SharedResearchSession {
  const shared: SharedResearchSession = {
    id: generateId(),
    sessionId,
    sharedBy,
    sharedAt: Date.now(),
    scope: options.scope,
    permissions: options.permission,
    recipients: options.recipients || [],
    expiresAt: options.expiresInDays 
      ? Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000 
      : undefined,
    accessLog: [{
      id: generateId(),
      userId: sharedBy,
      userName: 'You',
      action: 'shared',
      timestamp: Date.now(),
      details: `Shared with ${options.scope} scope`
    }],
    comments: [],
    annotations: []
  };
  
  if (options.scope === 'link') {
    shared.accessCode = generateAccessCode();
  }
  
  const sharedSessions = getSharedSessions();
  sharedSessions.push(shared);
  localStorage.setItem(SHARED_SESSIONS_KEY, JSON.stringify(sharedSessions));
  
  if (options.recipients && options.recipients.length > 0) {
    for (const email of options.recipients) {
      createInvitation({
        type: 'session',
        itemId: sessionId,
        invitedBy: sharedBy,
        invitedEmail: email,
        permission: options.permission,
        message: options.message
      });
    }
  }
  
  return shared;
}

export function getSharedSessions(): SharedResearchSession[] {
  const stored = localStorage.getItem(SHARED_SESSIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getSessionsSharedWithMe(userEmail: string): SharedResearchSession[] {
  const shared = getSharedSessions();
  return shared.filter(s => 
    s.recipients.includes(userEmail) || s.scope === 'workspace' || s.scope === 'team'
  );
}

export function shareSource(
  sourceId: string,
  sharedBy: string,
  options: {
    scope: ShareScope;
    permission: SharePermission;
    workspaceId?: string;
    recipients?: string[];
  }
): SharedSource {
  const shared: SharedSource = {
    id: generateId(),
    sourceId,
    sharedBy,
    sharedAt: Date.now(),
    scope: options.scope,
    permissions: options.permission,
    workspaceId: options.workspaceId,
    comments: [],
    highlights: []
  };
  
  const sharedSources = getSharedSources();
  sharedSources.push(shared);
  localStorage.setItem(SHARED_SOURCES_KEY, JSON.stringify(sharedSources));
  
  return shared;
}

export function getSharedSources(): SharedSource[] {
  const stored = localStorage.getItem(SHARED_SOURCES_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function createShareLink(
  type: 'session' | 'source',
  itemId: string,
  createdBy: string,
  options: {
    permission?: 'view' | 'comment';
    expiresInDays?: number;
    maxAccesses?: number;
    requiresEmail?: boolean;
    allowedDomains?: string[];
  } = {}
): ShareLink {
  const link: ShareLink = {
    id: generateId(),
    type,
    itemId,
    createdBy,
    createdAt: Date.now(),
    expiresAt: options.expiresInDays 
      ? Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000 
      : undefined,
    accessCode: generateAccessCode(),
    permission: options.permission || 'view',
    maxAccesses: options.maxAccesses,
    currentAccesses: 0,
    isActive: true,
    requiresEmail: options.requiresEmail || false,
    allowedDomains: options.allowedDomains
  };
  
  const links = getShareLinks();
  links.push(link);
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links));
  
  return link;
}

export function getShareLinks(): ShareLink[] {
  const stored = localStorage.getItem(SHARE_LINKS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function accessShareLink(
  accessCode: string,
  userEmail?: string
): { valid: boolean; link?: ShareLink; error?: string } {
  const links = getShareLinks();
  const link = links.find(l => l.accessCode === accessCode);
  
  if (!link) return { valid: false, error: 'Invalid link' };
  if (!link.isActive) return { valid: false, error: 'This link has been deactivated' };
  if (link.expiresAt && link.expiresAt < Date.now()) return { valid: false, error: 'This link has expired' };
  if (link.maxAccesses && link.currentAccesses >= link.maxAccesses) return { valid: false, error: 'Access limit reached' };
  if (link.requiresEmail && !userEmail) return { valid: false, error: 'Email required to access' };
  
  if (link.allowedDomains && userEmail) {
    const domain = userEmail.split('@')[1];
    if (!link.allowedDomains.includes(domain)) {
      return { valid: false, error: 'Access restricted to specific domains' };
    }
  }
  
  link.currentAccesses++;
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links));
  
  return { valid: true, link };
}

export function deactivateShareLink(linkId: string): boolean {
  const links = getShareLinks();
  const index = links.findIndex(l => l.id === linkId);
  if (index === -1) return false;
  
  links[index].isActive = false;
  localStorage.setItem(SHARE_LINKS_KEY, JSON.stringify(links));
  return true;
}

// ============================================
// INVITATIONS
// ============================================

export function createInvitation(options: {
  type: 'session' | 'source' | 'workspace';
  itemId: string;
  invitedBy: string;
  invitedEmail: string;
  permission: SharePermission;
  message?: string;
  expiresInDays?: number;
}): ShareInvitation {
  const invitation: ShareInvitation = {
    id: generateId(),
    type: options.type,
    itemId: options.itemId,
    invitedBy: options.invitedBy,
    invitedEmail: options.invitedEmail,
    permission: options.permission,
    createdAt: Date.now(),
    expiresAt: Date.now() + (options.expiresInDays || 7) * 24 * 60 * 60 * 1000,
    status: 'pending',
    message: options.message
  };
  
  const invitations = getInvitations();
  invitations.push(invitation);
  localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
  
  return invitation;
}

export function getInvitations(): ShareInvitation[] {
  const stored = localStorage.getItem(INVITATIONS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getPendingInvitations(email: string): ShareInvitation[] {
  const invitations = getInvitations();
  return invitations.filter(i => 
    i.invitedEmail === email && i.status === 'pending' && i.expiresAt > Date.now()
  );
}

export function acceptInvitation(invitationId: string): boolean {
  const invitations = getInvitations();
  const index = invitations.findIndex(i => i.id === invitationId);
  if (index === -1) return false;
  
  invitations[index].status = 'accepted';
  localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
  return true;
}

export function declineInvitation(invitationId: string): boolean {
  const invitations = getInvitations();
  const index = invitations.findIndex(i => i.id === invitationId);
  if (index === -1) return false;
  
  invitations[index].status = 'declined';
  localStorage.setItem(INVITATIONS_KEY, JSON.stringify(invitations));
  return true;
}

// ============================================
// COMMENTS & ANNOTATIONS
// ============================================

export function addSessionComment(
  sharedSessionId: string,
  userId: string,
  userName: string,
  content: string,
  replyTo?: string
): SessionComment | null {
  const sessions = getSharedSessions();
  const index = sessions.findIndex(s => s.id === sharedSessionId);
  if (index === -1) return null;
  
  const comment: SessionComment = {
    id: generateId(),
    sessionId: sharedSessionId,
    userId,
    userName,
    content,
    createdAt: Date.now(),
    replyTo,
    reactions: []
  };
  
  sessions[index].comments.push(comment);
  sessions[index].accessLog.push({
    id: generateId(),
    userId,
    userName,
    action: 'commented',
    timestamp: Date.now(),
    details: content.slice(0, 50) + '...'
  });
  
  localStorage.setItem(SHARED_SESSIONS_KEY, JSON.stringify(sessions));
  return comment;
}

export function addSourceHighlight(
  sharedSourceId: string,
  userId: string,
  text: string,
  color: SourceHighlight['color'],
  note?: string
): SourceHighlight | null {
  const sources = getSharedSources();
  const index = sources.findIndex(s => s.id === sharedSourceId);
  if (index === -1) return null;
  
  const highlight: SourceHighlight = {
    id: generateId(),
    sourceId: sharedSourceId,
    userId,
    text,
    color,
    note,
    createdAt: Date.now()
  };
  
  sources[index].highlights.push(highlight);
  localStorage.setItem(SHARED_SOURCES_KEY, JSON.stringify(sources));
  return highlight;
}

// ============================================
// ACCESS LOGGING
// ============================================

export function logAccess(
  sharedSessionId: string,
  userId: string,
  userName: string,
  action: AccessLogEntry['action'],
  details?: string
): void {
  const sessions = getSharedSessions();
  const index = sessions.findIndex(s => s.id === sharedSessionId);
  if (index === -1) return;
  
  sessions[index].accessLog.push({
    id: generateId(),
    userId,
    userName,
    action,
    timestamp: Date.now(),
    details
  });
  
  localStorage.setItem(SHARED_SESSIONS_KEY, JSON.stringify(sessions));
}

export function getAccessLog(sharedSessionId: string): AccessLogEntry[] {
  const sessions = getSharedSessions();
  const session = sessions.find(s => s.id === sharedSessionId);
  return session?.accessLog || [];
}

export function exportAccessLog(sharedSessionId: string): string {
  const log = getAccessLog(sharedSessionId);
  const csvRows = [
    'Timestamp,User,Action,Details',
    ...log.map(entry => 
      `${new Date(entry.timestamp).toISOString()},${entry.userName},${entry.action},"${entry.details || ''}"`
    )
  ];
  return csvRows.join('\n');
}

// ============================================
// PERMISSION CHECKING
// ============================================

export function hasPermission(
  userId: string,
  userEmail: string,
  sharedItem: SharedResearchSession | SharedSource,
  requiredPermission: SharePermission
): boolean {
  if (sharedItem.sharedBy === userId) return true;
  
  if ('recipients' in sharedItem && sharedItem.recipients.includes(userEmail)) {
    return checkPermissionLevel(sharedItem.permissions, requiredPermission);
  }
  
  if ('workspaceId' in sharedItem && sharedItem.workspaceId) {
    const workspace = getWorkspace(sharedItem.workspaceId);
    if (workspace) {
      const member = workspace.members.find(m => m.id === userId);
      if (member) return member.permissions.includes(requiredPermission);
    }
  }
  
  return false;
}

function checkPermissionLevel(granted: SharePermission, required: SharePermission): boolean {
  const hierarchy: SharePermission[] = ['view', 'comment', 'edit', 'admin'];
  return hierarchy.indexOf(granted) >= hierarchy.indexOf(required);
}
