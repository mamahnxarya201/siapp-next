# PMIS routing

The application uses App Router URLs as the source of truth for the active
screen. Zustand remains responsible for the in-memory project workspace and
interactive timeline state.

## Current sitemap

```text
/                              -> redirect to /dashboard
/dashboard                     -> portfolio dashboard
/project/timeline/[projectId]  -> three-panel project execution timeline
/user                          -> redirect to /dashboard (placeholder)
```

The timeline route validates `projectId` against the current mock project
catalog and returns a 404 for unknown projects. Existing mock IDs are stable
fixture IDs; opaque public IDs can be introduced later without changing the
route shape.

## Future destinations not implemented

```text
/project/detail/[projectId]
/project/people/[projectId]
/project/planning/[projectId]
/project/settings/[projectId]
/user/profile
/user/settings
/settings
```

The Planning interface remains a project-scoped sheet inside the timeline until
it needs independent browser history or loading behavior.
