export type AcademicStatus = "not_started" | "in_progress" | "requirements_pending" | "completed";

export type ModuleVersion = {
  module_version_id: string;
  module_no: number;
  title: string;
};

export type ModuleProgress = {
  module_no: number;
  module_version_id?: string | null;
  opened_at?: string | null;
  started_at?: string | null;
  content_completed_at?: string | null;
  submitted_at?: string | null;
  checkpoint_passed_at?: string | null;
  completed_at?: string | null;
};

export type ModuleRequirement = {
  requirement_id: string;
  module_version_id: string;
  requirement_key: string;
  requirement_type: string;
  required: boolean;
  position: number;
  status: string;
};

export type RequirementProgress = {
  requirement_id: string;
  status: AcademicStatus;
  satisfied_at?: string | null;
};

export type ModuleDependency = {
  module_version_id: string;
  depends_on_module_version_id: string;
  status: string;
};

const actionByRequirement: Record<string, string> = {
  content_completed: "continue_content",
  activity_completed: "complete_activity",
  evidence_completed: "submit_evidence",
  checkpoint_passed: "take_checkpoint",
  application_cycle_stage: "continue_application_cycle",
  final_assessment_passed: "take_final_assessment",
  final_project_approved: "await_project_review",
  administrative_requirement: "contact_support"
};

export function resolveModuleStates(
  modules: ModuleVersion[],
  progressRows: ModuleProgress[],
  dependencies: ModuleDependency[],
  requirements: ModuleRequirement[],
  requirementRows: RequirementProgress[]
) {
  const progressByVersion = new Map(progressRows.filter(row => row.module_version_id)
    .map(row => [row.module_version_id as string, row]));
  const progressByNumber = new Map(progressRows.map(row => [row.module_no, row]));
  const completedVersions = new Set(progressRows.filter(row => row.completed_at && row.module_version_id)
    .map(row => row.module_version_id as string));
  const satisfied = new Set(requirementRows
    .filter(row => row.status === "completed" && row.satisfied_at)
    .map(row => row.requirement_id));

  return [...modules].sort((a, b) => a.module_no - b.module_no).map(module => {
    const row = progressByVersion.get(module.module_version_id) ?? progressByNumber.get(module.module_no);
    const blockers = dependencies.filter(dependency => dependency.status === "published" &&
      dependency.module_version_id === module.module_version_id &&
      !completedVersions.has(dependency.depends_on_module_version_id));
    const mandatory = requirements.filter(requirement => requirement.status === "published" &&
      requirement.module_version_id === module.module_version_id && requirement.required)
      .sort((a, b) => a.position - b.position);
    const pending = mandatory.filter(requirement => !satisfied.has(requirement.requirement_id));
    const completed = Boolean(row?.completed_at);
    const unlocked = blockers.length === 0;
    const started = Boolean(row?.started_at || row?.opened_at || row?.submitted_at || row?.content_completed_at);
    const status: AcademicStatus = completed ? "completed" : !started ? "not_started" :
      pending.length ? "requirements_pending" : "in_progress";
    const nextRequirement = pending[0] ?? null;
    const nextAction = !unlocked ? "locked" : completed ? "next_module" :
      nextRequirement ? (actionByRequirement[nextRequirement.requirement_type] ?? "continue_course") :
      started ? "continue_content" : "start_module";
    return {
      number: module.module_no,
      moduleVersionId: module.module_version_id,
      title: module.title,
      unlocked,
      completed,
      submitted: Boolean(row?.submitted_at),
      status,
      pendingRequirements: pending.length,
      nextRequirement: nextRequirement ? {
        id: nextRequirement.requirement_id,
        key: nextRequirement.requirement_key,
        type: nextRequirement.requirement_type
      } : null,
      nextAction
    };
  });
}

export type StableOption = {option_id: string; option_text: string; feedback?: string | null};
export type StableQuestion = {
  question_id: string;
  question_key: string;
  question_version: number;
  prompt: string;
  correct_option_id: string;
  correct_feedback?: string | null;
  review_concept: string;
  options: StableOption[];
};

export function gradeStableCheckpoint(questions: StableQuestion[], answers: string[], passPercent: number) {
  if (questions.length === 0 || answers.length !== questions.length ||
      answers.some(answer => typeof answer !== "string" || !answer)) {
    throw new Error("answers_invalid");
  }
  const known = questions.every((question, index) =>
    question.options.some(option => option.option_id === answers[index]));
  if (!known) throw new Error("answers_invalid");
  const details = questions.map((question, index) => {
    const selected = question.options.find(option => option.option_id === answers[index])!;
    const correct = answers[index] === question.correct_option_id;
    return {
      question_id: question.question_id,
      selected_option_id: selected.option_id,
      correct,
      feedback: correct ? (question.correct_feedback ?? "Resposta correta.") :
        (selected.feedback ?? `Revise: ${question.review_concept}`)
    };
  });
  const score = details.filter(detail => detail.correct).length;
  const scorePercent = Math.round(score * 10000 / questions.length) / 100;
  return {score, total: questions.length, scorePercent, passed: scorePercent >= passPercent, details};
}

export function checkpointSnapshot(questions: StableQuestion[]) {
  return questions.map(question => ({
    question_id: question.question_id,
    question_key: question.question_key,
    question_version: question.question_version,
    prompt: question.prompt,
    options: question.options.map(option => ({option_id: option.option_id, option_text: option.option_text})),
    correct_option_id: question.correct_option_id
  }));
}
