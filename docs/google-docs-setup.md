# Google Docs Integration Setup

This guide explains how to configure automatic Google Docs creation and syncing for project documents.

## Prerequisites

- A Google Cloud project with billing enabled
- Access to the Google Cloud Console

## Step 1: Create a Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **IAM & Admin > Service Accounts**
4. Click **Create Service Account**
5. Give it a name (e.g. `iranenovin-docs`) and click **Create and Continue**
6. Skip the optional roles and click **Done**

## Step 2: Create a Key

1. Click on the newly created service account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Choose **JSON** and click **Create**
5. Save the downloaded JSON file securely (do not commit it to the repository)

## Step 3: Enable APIs

Enable the following APIs in the [API Library](https://console.cloud.google.com/apis/library):

- **Google Docs API**
- **Google Drive API**

## Step 4: Set Environment Variables

Add the following to your `.env.local` file:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

The email and private key can be found in the JSON key file you downloaded in Step 2.

### Optional: Organize Documents in a Folder

To automatically move created documents into a specific Google Drive folder:

1. Create a folder in Google Drive
2. Share the folder with the service account email (give it **Editor** access)
3. Copy the folder ID from the URL (the part after `/folders/`)
4. Add to `.env.local`:

```env
GOOGLE_DOCS_FOLDER_ID=your-folder-id-here
```

## Step 5: Share the Folder (Important)

If you set a `GOOGLE_DOCS_FOLDER_ID`, make sure to share that folder with the service account email address and grant it **Editor** permissions. Otherwise the service account will not be able to move files into the folder.

## How It Works

Once configured:

- When an admin triggers **Regenerate with AI** or the AI trigger runs a full analysis, the generated project document is automatically synced to Google Docs.
- If no Google Doc exists yet for a project, a new one is created and the URL is saved.
- If a Google Doc already exists, its content is replaced with the latest generated document.
- Created documents are set to "Anyone with the link can view" by default.

## Troubleshooting

- **Documents not being created**: Check that both `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_PRIVATE_KEY` are set correctly. The private key must include the `\n` newline characters.
- **Permission errors**: Make sure the Google Docs API and Google Drive API are both enabled.
- **Folder move fails**: Ensure the service account has Editor access to the target folder.
