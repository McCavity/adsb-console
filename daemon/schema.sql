CREATE TABLE IF NOT EXISTS range_record (
  sector    INTEGER PRIMARY KEY,   -- 0..35, je zehn Grad, 0 = 000..009
  max_nm    REAL    NOT NULL,
  hex       TEXT,
  callsign  TEXT,
  alt_ft    INTEGER,
  seen_at   TEXT    NOT NULL       -- ISO 8601 mit Offset
);
