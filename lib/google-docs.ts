import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export function isGoogleDocsConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_PRIVATE_KEY);
}

export async function createProjectDoc(params: {
  title: string;
  ideaId: string;
  initialContent: string;
}): Promise<{ docId: string; docUrl: string } | null> {
  const auth = getAuth();
  if (!auth) return null;

  try {
    const docs = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    // Create the doc
    const doc = await docs.documents.create({
      requestBody: { title: `[IranENovin] ${params.title}` },
    });
    const docId = doc.data.documentId!;

    // Write initial content
    if (params.initialContent) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{
            insertText: { location: { index: 1 }, text: params.initialContent },
          }],
        },
      });
    }

    // Make it viewable by anyone with the link
    await drive.permissions.create({
      fileId: docId,
      requestBody: { role: "reader", type: "anyone" },
    });

    // Move to folder if configured
    const folderId = process.env.GOOGLE_DOCS_FOLDER_ID;
    if (folderId) {
      const file = await drive.files.get({ fileId: docId, fields: "parents" });
      const prevParents = file.data.parents?.join(",") || "";
      await drive.files.update({
        fileId: docId,
        addParents: folderId,
        removeParents: prevParents,
        fields: "id, parents",
      });
    }

    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`[GoogleDocs] Created doc for ${params.ideaId}: ${docUrl}`);
    return { docId, docUrl };
  } catch (e) {
    console.error("[GoogleDocs] Create failed:", e);
    return null;
  }
}

export async function writeToDoc(params: {
  docId: string;
  content: string;
}): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  try {
    const docs = google.docs({ version: "v1", auth });

    // Get current document to find end index
    const doc = await docs.documents.get({ documentId: params.docId });
    const endIndex = doc.data.body?.content?.slice(-1)?.[0]?.endIndex || 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests: any[] = [];
    // Delete existing content (except the very first character)
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } },
      });
    }
    // Insert new content
    requests.push({
      insertText: { location: { index: 1 }, text: params.content },
    });

    await docs.documents.batchUpdate({
      documentId: params.docId,
      requestBody: { requests },
    });

    console.log(`[GoogleDocs] Updated doc ${params.docId}`);
    return true;
  } catch (e) {
    console.error("[GoogleDocs] Write failed:", e);
    return false;
  }
}

export async function getDocContent(docId: string): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;

  try {
    const docs = google.docs({ version: "v1", auth });
    const doc = await docs.documents.get({ documentId: docId });

    // Extract text from document body
    let text = "";
    for (const element of doc.data.body?.content || []) {
      if (element.paragraph) {
        for (const el of element.paragraph.elements || []) {
          if (el.textRun?.content) text += el.textRun.content;
        }
      }
    }
    return text;
  } catch (e) {
    console.error("[GoogleDocs] Read failed:", e);
    return null;
  }
}
