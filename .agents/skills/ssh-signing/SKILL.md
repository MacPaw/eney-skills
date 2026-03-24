---
name: ssh-signing
description: Set up SSH key commit signing for Git and GitHub so all commits (including those made via Claude Code) are cryptographically verified.
metadata:
  author: macpaw
  version: "1.0"
---

# SSH Key Commit Signing Setup

This skill configures SSH-based commit signing so that every commit — including those made via Claude Code — is cryptographically verified as authorized by you.

**Why this matters:** When AI tools commit code on your behalf, SSH signing proves the commit was authorized by you. Without it, there is no cryptographic guarantee of authorship.

---

## Step 1: Check prerequisites

Verify that `git` and `gh` are installed and authenticated:

```bash
git --version
gh auth status
```

If `gh` is not authenticated, ask the user to run `! gh auth login` interactively.

---

## Step 2: Get user info

Retrieve the user's Git identity:

```bash
git config --global user.name
git config --global user.email
```

If either is empty, ask the user for their **GitHub username** and **GitHub email address**, then set them:

```bash
git config --global user.name "USERNAME"
git config --global user.email "EMAIL"
```

Store the email in a variable — you'll need it in later steps.

---

## Step 3: Check for existing SSH keys

```bash
ls -la ~/.ssh/*.pub 2>/dev/null
```

If public keys exist (e.g. `id_ed25519.pub`, `id_rsa.pub`), present them to the user and ask which one to use for signing — or whether to generate a new one.

If no keys exist, proceed to Step 4.

---

## Step 4: Generate a new SSH key (if needed)

Generate an Ed25519 key for signing:

```bash
ssh-keygen -t ed25519 -C "EMAIL" -f ~/.ssh/id_ed25519 -N ""
```

- `-N ""` creates the key without a passphrase (convenient for signing; the key is still file-protected).
- If `~/.ssh/id_ed25519` already exists and the user chose to reuse it in Step 3, skip this step.

Verify the key was created:

```bash
ls -la ~/.ssh/id_ed25519 ~/.ssh/id_ed25519.pub
```

---

## Step 5: Configure Git for SSH signing

Set the signing key and enable commit signing globally:

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/KEY_FILE.pub
git config --global commit.gpgsign true
```

Replace `KEY_FILE.pub` with the actual key filename chosen in Step 3 or generated in Step 4.

Verify the configuration:

```bash
git config --global --get gpg.format
git config --global --get user.signingkey
git config --global --get commit.gpgsign
```

---

## Step 6: Add the signing key to GitHub

Upload the public key as a **signing key** (not authentication):

```bash
gh ssh-key add ~/.ssh/KEY_FILE.pub --type signing --title "Signing key ($(hostname))"
```

Confirm it was added:

```bash
gh ssh-key list
```

If you get a permission error, the user needs to refresh scopes:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key
```

Then retry the upload.

---

## Step 7: Set up allowed signers (for local verification)

Create an allowed signers file so `git verify-commit` works locally:

```bash
echo "EMAIL $(cat ~/.ssh/KEY_FILE.pub)" >> ~/.ssh/allowed_signers
```

Configure Git to use it:

```bash
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

---

## Step 8: Test

Navigate to any git repository and make a signed test commit:

```bash
git commit --allow-empty -m "test: verify SSH signing"
git verify-commit HEAD
```

Expected output should include:

```
Good "git" signature for EMAIL with ED25519 key SHA256:...
```

Then delete the test commit:

```bash
git reset --hard HEAD~1
```

Tell the user that SSH commit signing is now configured and all future commits will be signed automatically.

---

## Troubleshooting

### `error: Load key ... invalid format`

The signing key path is wrong or points to the private key instead of the public key. Ensure `user.signingkey` ends with `.pub`:

```bash
git config --global --get user.signingkey
```

### `error: ssh-keygen -Y sign is not available`

Your OpenSSH version is too old. SSH signing requires OpenSSH 8.0+. Check:

```bash
ssh -V
```

On macOS, update via `brew install openssh`. On Ubuntu, update via `sudo apt update && sudo apt install openssh-client`.

### Commits show as `Unverified` on GitHub

- Confirm the email in your key matches a **verified** GitHub email (Settings > Emails).
- Confirm the key was uploaded as a **signing** key (not authentication): `gh ssh-key list`.
- Confirm `commit.gpgsign` is `true`: `git config --global --get commit.gpgsign`.

### `error: insufficient OAuth scopes`

Re-run:

```bash
gh auth refresh -h github.com -s admin:ssh_signing_key
```

### `No principal matched` during verify-commit

The allowed signers file is missing or the email doesn't match. Verify:

```bash
cat ~/.ssh/allowed_signers
git config --global --get user.email
```

The email in `allowed_signers` must exactly match `user.email`.

---

## Quick reference

```bash
# Full setup in one block (replace EMAIL and KEY_FILE)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/KEY_FILE.pub
git config --global commit.gpgsign true
gh ssh-key add ~/.ssh/KEY_FILE.pub --type signing --title "Signing key ($(hostname))"
echo "EMAIL $(cat ~/.ssh/KEY_FILE.pub)" >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```
