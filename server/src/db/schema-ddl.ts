export const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    description TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    first_mes TEXT DEFAULT '',
    mes_example TEXT DEFAULT '',
    scenario TEXT DEFAULT '',
    system_prompt TEXT DEFAULT '',
    post_history_instructions TEXT DEFAULT '',
    alternate_greetings TEXT DEFAULT '[]',
    creator TEXT DEFAULT '',
    creator_notes TEXT DEFAULT '',
    character_version TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    spec TEXT DEFAULT 'chara_card_v2',
    spec_version TEXT DEFAULT '2.0',
    extensions TEXT DEFAULT '{}',
    character_book TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    name TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    name TEXT DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    is_hidden INTEGER DEFAULT 0,
    swipe_id INTEGER DEFAULT 0,
    swipes TEXT DEFAULT '[]',
    gen_started TEXT,
    gen_finished TEXT,
    extra TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_type TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS secrets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS world_info_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS world_info_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    uid INTEGER NOT NULL,
    keys TEXT DEFAULT '[]',
    secondary_keys TEXT DEFAULT '[]',
    content TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    insertion_order INTEGER DEFAULT 100,
    case_sensitive INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 10,
    position TEXT DEFAULT 'before_char',
    extensions TEXT DEFAULT '{}',
    constant INTEGER DEFAULT 0,
    selective INTEGER DEFAULT 0,
    select_logic INTEGER DEFAULT 0,
    "order" INTEGER DEFAULT 100,
    exclude_recursion INTEGER DEFAULT 0,
    prevent_recursion INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 100,
    use_probability INTEGER DEFAULT 1,
    depth INTEGER DEFAULT 4,
    group_name TEXT DEFAULT '',
    group_override INTEGER DEFAULT 0,
    group_weight INTEGER DEFAULT 100,
    scan_depth INTEGER DEFAULT 0,
    match_whole_words INTEGER DEFAULT 0,
    use_group_scoring INTEGER DEFAULT 0,
    automation_id TEXT DEFAULT '',
    role INTEGER DEFAULT 0,
    sticky INTEGER DEFAULT 0,
    cooldown INTEGER DEFAULT 0,
    delay INTEGER DEFAULT 0,
    triggers TEXT DEFAULT '[]',
    use_regex INTEGER DEFAULT 0,
    vectorized INTEGER DEFAULT 0,
    ignore_budget INTEGER DEFAULT 0,
    match_persona_desc INTEGER DEFAULT 0,
    match_char_desc INTEGER DEFAULT 0,
    match_char_personality INTEGER DEFAULT 0,
    match_scenario INTEGER DEFAULT 0,
    delay_until_recursion INTEGER DEFAULT 0,
    character_filter TEXT DEFAULT '{}',
    content_hash TEXT DEFAULT '',
    FOREIGN KEY (book_id) REFERENCES world_info_books(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS groups_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    members TEXT DEFAULT '[]',
    activation_strategy TEXT DEFAULT 'natural_order',
    allow_self_responses INTEGER DEFAULT 0,
    chat_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    folder_type TEXT DEFAULT 'NONE',
    sort_order INTEGER DEFAULT 0,
    color TEXT,
    color2 TEXT,
    is_hidden INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entity_tags (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (entity_type, entity_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 2,
    role INTEGER DEFAULT 0,
    lorebook_id INTEGER,
    title TEXT,
    is_default INTEGER DEFAULT 0,
    avatar_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS persona_connections (
    persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    PRIMARY KEY (persona_id, entity_type, entity_id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    allow_self_responses INTEGER DEFAULT 0,
    activation_strategy INTEGER DEFAULT 0,
    generation_mode INTEGER DEFAULT 0,
    disabled_members TEXT DEFAULT '[]',
    fav INTEGER DEFAULT 0,
    current_chat_id INTEGER,
    auto_mode_delay INTEGER DEFAULT 5,
    join_prefix TEXT DEFAULT '',
    join_suffix TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (group_id, character_id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chats_character_id ON chats(character_id);
  CREATE INDEX IF NOT EXISTS idx_world_info_entries_book_id ON world_info_entries(book_id);
  CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_persona_connections ON persona_connections(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
`;
