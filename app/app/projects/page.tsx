import { redirect } from "next/navigation";

// Block 11: projects list moved to /account. This route is kept as a
// permanent redirect so any old bookmarks / share-links / cached UI keep
// working without 404.
export default function ProjectsListRedirect() {
  redirect("/account");
}
