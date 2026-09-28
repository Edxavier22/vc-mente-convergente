-- Cover every foreign key reported by the performance advisor. These indexes
-- are additive and support review, final-assessment and version lookups.
create index if not exists vc_course_assessment_attempts_product_idx
 on public.vc_course_assessment_attempts(product_id);

create index if not exists vc_course_reviews_reviewer_idx
 on public.vc_course_reviews(reviewer_id);

create index if not exists vc_university_final_attempts_content_version_idx
 on public.vc_university_final_attempts(course_id, course_version);

create index if not exists vc_university_final_sessions_content_version_idx
 on public.vc_university_final_sessions(course_id, course_version);
