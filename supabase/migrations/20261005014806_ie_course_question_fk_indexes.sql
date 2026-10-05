-- Indexes for the two foreign keys added to the canonical question bank.
create index if not exists vc_university_questions_competency_idx
  on public.vc_university_questions (competency_id);

create index if not exists vc_university_questions_correct_option_idx
  on public.vc_university_questions (question_id, correct_option_id);
