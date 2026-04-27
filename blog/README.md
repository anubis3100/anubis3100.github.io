# blog/

drop new posts here as `.md` files. the filename (without `.md`) becomes the post title.

## how it works

The site fetches `blog/manifest.json` to know which posts exist. To add a new post:

**Option A — auto (recommended):** if your repo is on GitHub, the site can also auto-discover posts via the GitHub API. Edit `app.js` and set `BLOG_GITHUB_REPO` to your `"owner/repo"` string. Then any `.md` file you commit to `blog/` will appear automatically.

**Option B — manual manifest:** edit `manifest.json` and add the new filename to the `posts` array.

Either way, write your markdown, commit/push, done.

This `README.md` is ignored by the blog reader.
