# Eney-skills

Repository for Eney skills

## How to start

### Prerequisites

1. Node.js v24+.
2. For local development, clone [playground repo](https://github.com/MacPawLabs/eney-jsx-playground).

### Steps

#### 1. Create new extension

You can create new extension via CLI. Go to root folder and add new one via:

```bash
node cli/main.ts create
```

Please create new extension inside `eney-skills/extensions/` folder as other commands rely on this folder.

#### 2. Update code inside extension

Do what your imagination wants.
It's important that `setupTool` is called at the end.

#### 3. Publish extension

Create PR to the main branch. After PR is merged, CI will publish extension to staging.

#### 4. Call extension inside Eney

After CI is done, check Eney Admin for created manifest. Run this manifest via "Run" button.
