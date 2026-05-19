import { createProject } from "../actions";

// /app/projects/new
//
// Convenience route: triggers createProject() server action and lets it
// redirect to /app?project=<id>. Useful so external links (or the CTA on
// the landing page) can point to a stable URL that always makes a fresh
// project, without forcing a form submission.
//
// Rendering this page never returns visible content — createProject()
// always either redirects or throws.
export default async function NewProjectPage() {
  await createProject();
  return null;
}
