CREATE TABLE `evaluations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` text NOT NULL,
	`teacher_name` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`aprendizagem` integer DEFAULT 0 NOT NULL,
	`concentracao` integer DEFAULT 0 NOT NULL,
	`tempo` integer DEFAULT 0 NOT NULL,
	`emocional` integer DEFAULT 0 NOT NULL,
	`relacionamento` integer DEFAULT 0 NOT NULL,
	`saude` integer DEFAULT 0 NOT NULL,
	`disciplina` integer DEFAULT 0 NOT NULL,
	`assiduidade` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_student_teacher_idx` ON `evaluations` (`student_id`,`teacher_name`);
--> statement-breakpoint
INSERT INTO `evaluations` (`student_id`,`teacher_name`,`priority`,`aprendizagem`,`concentracao`,`tempo`,`emocional`,`relacionamento`,`saude`,`disciplina`,`assiduidade`,`notes`,`updated_at`) VALUES
('demo-1a-adm','Professor demonstrativo 01',1,1,1,1,0,0,0,0,1,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 02',1,1,1,1,0,0,0,0,1,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 03',1,1,1,0,1,0,0,0,1,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 04',1,1,0,0,1,1,0,1,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 05',1,0,0,0,0,0,1,1,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 06',1,0,0,0,0,0,0,0,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 07',0,0,0,0,0,0,0,0,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 08',0,0,0,0,0,0,0,0,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 09',0,0,0,0,0,0,0,0,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z'),
('demo-1a-adm','Professor demonstrativo 10',0,0,0,0,0,0,0,0,0,'Dado demonstrativo','2026-07-31T12:00:00.000Z');
