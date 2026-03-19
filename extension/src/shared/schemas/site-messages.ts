/**
 * Zod schemas for the site ↔ extension postMessage protocol.
 *
 * Every message flowing between the Trail account site and the extension
 * content script must comply with one of these schemas.
 *
 * Content script uses lightweight manual validation (no Zod import) but
 * the shapes are kept in sync via the exported type aliases below.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SITE_SOURCE = "trail-site" as const;
export const EXTENSION_SOURCE = "trail-extension" as const;

/** TTL window — messages older than this (ms) are rejected. */
export const MESSAGE_TTL_MS = 30_000;

/** Max nonce set size — evict oldest when exceeded. */
export const MAX_NONCE_SET_SIZE = 100;

// ---------------------------------------------------------------------------
// Site → Extension message types
// ---------------------------------------------------------------------------

export const SiteMessageType = {
  PING: "PING",
  OPEN_TRAIL_PANEL: "OPEN_TRAIL_PANEL",
  ENTER_EDITOR_MODE: "ENTER_EDITOR_MODE",
  EXIT_EDITOR_MODE: "EXIT_EDITOR_MODE",
  SAVE_EDITOR_MODE: "SAVE_EDITOR_MODE",
  CANCEL_EDITOR_MODE: "CANCEL_EDITOR_MODE",
  SELECT_NODE: "SELECT_NODE",
  UPDATE_NODE_METADATA: "UPDATE_NODE_METADATA",
  AUTH_REVOKED: "AUTH_REVOKED",
  AUTH_CODE_RELAY: "AUTH_CODE_RELAY",
} as const;

export type SiteMessageTypeName = (typeof SiteMessageType)[keyof typeof SiteMessageType];

// ---------------------------------------------------------------------------
// Extension → Site message types
// ---------------------------------------------------------------------------

export const ExtensionMessageType = {
  PONG: "PONG",
  OPEN_TRAIL_PANEL_ACK: "OPEN_TRAIL_PANEL_ACK",
  EDITOR_MODE_ENTERED: "EDITOR_MODE_ENTERED",
  EDITOR_MODE_EXITED: "EDITOR_MODE_EXITED",
  EDITOR_MODE_SAVED: "EDITOR_MODE_SAVED",
  EDITOR_MODE_CANCELLED: "EDITOR_MODE_CANCELLED",
  AUTH_REVOKED_ACK: "AUTH_REVOKED_ACK",
  AUTH_CODE_RELAY_ACK: "AUTH_CODE_RELAY_ACK",
  NODE_SELECTED: "NODE_SELECTED",
  NODE_METADATA_UPDATED: "NODE_METADATA_UPDATED",
  TREE_UPDATED: "TREE_UPDATED",
} as const;

export type ExtensionMessageTypeName =
  (typeof ExtensionMessageType)[keyof typeof ExtensionMessageType];

// ---------------------------------------------------------------------------
// Base schemas
// ---------------------------------------------------------------------------

export const SiteMessageBase = z.object({
  source: z.literal(SITE_SOURCE),
  type: z.string(),
  requestId: z.string().uuid(),
  timestamp: z.number(),
});

export const ExtensionMessageBase = z.object({
  source: z.literal(EXTENSION_SOURCE),
  type: z.string(),
  requestId: z.string().uuid(),
  timestamp: z.number(),
});

// ---------------------------------------------------------------------------
// Site → Extension schemas
// ---------------------------------------------------------------------------

export const PingMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.PING),
});

export const OpenTrailPanelMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.OPEN_TRAIL_PANEL),
});

export const EnterEditorModeMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.ENTER_EDITOR_MODE),
  treeId: z.string(),
});

export const ExitEditorModeMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.EXIT_EDITOR_MODE),
});

export const SaveEditorModeMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.SAVE_EDITOR_MODE),
});

export const CancelEditorModeMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.CANCEL_EDITOR_MODE),
});

export const SelectNodeMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.SELECT_NODE),
  nodeId: z.string(),
});

export const UpdateNodeMetadataMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.UPDATE_NODE_METADATA),
  nodeId: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const AuthRevokedMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.AUTH_REVOKED),
});

export const AuthCodeRelayMessage = SiteMessageBase.extend({
  type: z.literal(SiteMessageType.AUTH_CODE_RELAY),
  code: z.string(),
  codeVerifier: z.string(),
  redirectUri: z.string(),
});

/** Discriminated union of all valid site → extension messages. */
export const SiteMessage = z.discriminatedUnion("type", [
  PingMessage,
  OpenTrailPanelMessage,
  EnterEditorModeMessage,
  ExitEditorModeMessage,
  SaveEditorModeMessage,
  CancelEditorModeMessage,
  SelectNodeMessage,
  UpdateNodeMetadataMessage,
  AuthRevokedMessage,
  AuthCodeRelayMessage,
]);

export type SiteMessage = z.infer<typeof SiteMessage>;

// ---------------------------------------------------------------------------
// Extension → Site schemas
// ---------------------------------------------------------------------------

export const PongMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.PONG),
  version: z.string(),
  authenticated: z.boolean(),
  editorMode: z.boolean(),
});

export const OpenTrailPanelAckMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.OPEN_TRAIL_PANEL_ACK),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const EditorModeEnteredMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.EDITOR_MODE_ENTERED),
  treeId: z.string(),
  treeState: z.unknown(),
});

export const EditorModeExitedMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.EDITOR_MODE_EXITED),
});

export const EditorModeSavedMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.EDITOR_MODE_SAVED),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const EditorModeCancelledMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.EDITOR_MODE_CANCELLED),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const AuthRevokedAckMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.AUTH_REVOKED_ACK),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const AuthCodeRelayAckMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.AUTH_CODE_RELAY_ACK),
  ok: z.boolean(),
  error: z.string().optional(),
});

export const NodeSelectedMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.NODE_SELECTED),
  nodeId: z.string(),
  nodeData: z.unknown(),
});

export const NodeMetadataUpdatedMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.NODE_METADATA_UPDATED),
  nodeId: z.string(),
});

export const TreeUpdatedMessage = ExtensionMessageBase.extend({
  type: z.literal(ExtensionMessageType.TREE_UPDATED),
  treeId: z.string(),
  patch: z.unknown(),
});

/** Discriminated union of all valid extension → site messages. */
export const ExtensionMessage = z.discriminatedUnion("type", [
  PongMessage,
  OpenTrailPanelAckMessage,
  EditorModeEnteredMessage,
  EditorModeExitedMessage,
  EditorModeSavedMessage,
  EditorModeCancelledMessage,
  AuthRevokedAckMessage,
  AuthCodeRelayAckMessage,
  NodeSelectedMessage,
  NodeMetadataUpdatedMessage,
  TreeUpdatedMessage,
]);

export type ExtensionMessage = z.infer<typeof ExtensionMessage>;

// ---------------------------------------------------------------------------
// Convenience type aliases
// ---------------------------------------------------------------------------

export type PingMessage = z.infer<typeof PingMessage>;
export type PongMessage = z.infer<typeof PongMessage>;
export type OpenTrailPanelMessage = z.infer<typeof OpenTrailPanelMessage>;
export type OpenTrailPanelAckMessage = z.infer<typeof OpenTrailPanelAckMessage>;
export type EnterEditorModeMessage = z.infer<typeof EnterEditorModeMessage>;
export type ExitEditorModeMessage = z.infer<typeof ExitEditorModeMessage>;
export type SaveEditorModeMessage = z.infer<typeof SaveEditorModeMessage>;
export type CancelEditorModeMessage = z.infer<typeof CancelEditorModeMessage>;
export type SelectNodeMessage = z.infer<typeof SelectNodeMessage>;
export type UpdateNodeMetadataMessage = z.infer<typeof UpdateNodeMetadataMessage>;
export type AuthRevokedMessage = z.infer<typeof AuthRevokedMessage>;
export type AuthCodeRelayMessage = z.infer<typeof AuthCodeRelayMessage>;
export type EditorModeEnteredMessage = z.infer<typeof EditorModeEnteredMessage>;
export type EditorModeExitedMessage = z.infer<typeof EditorModeExitedMessage>;
export type EditorModeSavedMessage = z.infer<typeof EditorModeSavedMessage>;
export type EditorModeCancelledMessage = z.infer<typeof EditorModeCancelledMessage>;
export type AuthRevokedAckMessage = z.infer<typeof AuthRevokedAckMessage>;
export type AuthCodeRelayAckMessage = z.infer<typeof AuthCodeRelayAckMessage>;
export type NodeSelectedMessage = z.infer<typeof NodeSelectedMessage>;
export type NodeMetadataUpdatedMessage = z.infer<typeof NodeMetadataUpdatedMessage>;
export type TreeUpdatedMessage = z.infer<typeof TreeUpdatedMessage>;
