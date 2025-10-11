# Publishing the Pending Workspace Changes

This workspace already contains the commit `58424fc` (`feat: refresh storefront square integration`).
Use one of the options below to copy that work into your GitHub repository.

## Option A – Push the commit directly

1. Ensure the remote points to your repository:
   ```bash
   git remote add origin https://github.com/joshccrump/custom-clothing-site.git  # skip if it already exists
   git remote -v
   ```
2. Create a GitHub personal access token (PAT) with the **`repo`** scope.
3. Push the branch while supplying the PAT when prompted:
   ```bash
   git push https://<PAT>@github.com/joshccrump/custom-clothing-site.git work:main
   ```
   Replace `<PAT>` with the token value. The command publishes the current `work`
   branch to `main` on GitHub in a single step.

> **Tip:** If you prefer SSH, add your private key to the container (or your local
> machine) and run `git push origin work:main` instead.

## Option B – Export the files and upload manually

1. Generate an archive of the committed files:
   ```bash
   git archive --format=zip --output=/tmp/custom-clothing-site.zip HEAD
   ```
2. Download `/tmp/custom-clothing-site.zip` from the workspace and extract it on
   your machine.
3. Upload the extracted files into your GitHub repository (either through the web
   interface or by copying them into a local clone and committing).

## Option C – Apply the commit in another clone

1. From a clone of `joshccrump/custom-clothing-site` on your computer, download
   the patch file:
   ```bash
   curl -L https://raw.githubusercontent.com/joshccrump/custom-clothing-site/main/README-APPLY-CHANGES.md -o README-APPLY-CHANGES.md
   ```
   *(Skip this if you already have this document locally.)*
2. Copy the patch from the workspace:
   ```bash
   git format-patch -1 HEAD --stdout > /tmp/storefront-refresh.patch
   ```
   Transfer `storefront-refresh.patch` to your machine.
3. In your local clone, apply the patch and commit:
   ```bash
   git apply storefront-refresh.patch
   git commit -am "feat: refresh storefront square integration"
   git push origin main
   ```

Pick whichever method best fits your workflow. Once the files land on `main`,
GitHub Pages and Vercel will pick up the changes on their next deployments.
