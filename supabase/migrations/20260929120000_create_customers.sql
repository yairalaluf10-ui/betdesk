create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null unique,
  preferred_league text not null
);

alter table public.customers enable row level security;

insert into public.customers (name, email, preferred_league) values
  ('יוסי כהן',        'yossi.cohen@example.com',     'ליגת העל'),
  ('דנה לוי',         'dana.levi@example.com',       'פרמייר ליג'),
  ('אבי מזרחי',       'avi.mizrahi@example.com',     'לה ליגה'),
  ('מיכל פרץ',        'michal.peretz@example.com',   'ליגת האלופות'),
  ('רון ביטון',       'ron.biton@example.com',       'NBA'),
  ('נועה אברהם',      'noa.avraham@example.com',     'סרייה A'),
  ('איתי פרידמן',     'itay.friedman@example.com',   'בונדסליגה'),
  ('שירה אזולאי',     'shira.azoulay@example.com',   'ליגת העל'),
  ('עומר דהן',        'omer.dahan@example.com',      'יורוליג'),
  ('תמר שפירא',       'tamar.shapira@example.com',   'פרמייר ליג'),
  ('אלון גבאי',       'alon.gabay@example.com',      'ליג 1'),
  ('יעל אוחיון',      'yael.ohayon@example.com',     'לה ליגה'),
  ('גיא רוזנברג',     'guy.rosenberg@example.com',   'ליגת העל'),
  ('ליאור חדד',       'lior.hadad@example.com',      'NBA'),
  ('הילה סויסה',      'hila.swisa@example.com',      'ליגת האלופות'),
  ('עידו קליין',      'ido.klein@example.com',       'פרמייר ליג'),
  ('רותם אלבז',       'rotem.elbaz@example.com',     'סרייה A'),
  ('נדב ששון',        'nadav.sasson@example.com',    'ליגת העל'),
  ('מאיה וקנין',      'maya.vaknin@example.com',     'בונדסליגה'),
  ('אורי גולדברג',    'uri.goldberg@example.com',    'יורוליג'),
  ('שני עמר',         'shani.amar@example.com',      'לה ליגה'),
  ('דור בן דוד',      'dor.bendavid@example.com',    'ליגת העל'),
  ('ענבל כץ',         'inbal.katz@example.com',      'פרמייר ליג'),
  ('אייל טל',         'eyal.tal@example.com',        'NBA'),
  ('קרן מלכה',        'keren.malka@example.com',     'ליגת האלופות'),
  ('עמית שטרן',       'amit.stern@example.com',      'ליג 1'),
  ('ליה נחום',        'lia.nahum@example.com',       'ליגת העל'),
  ('בן אשכנזי',       'ben.ashkenazi@example.com',   'סרייה A'),
  ('אביגיל יוסף',     'avigail.yosef@example.com',   'פרמייר ליג'),
  ('טל ברק',          'tal.barak@example.com',       'יורוליג');
