import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';
import { CanonicalSchema, ProjectRecord } from '../../types/schema';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Google Auth Provider with Google Workspace Scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/documents');
provider.addScope('https://www.googleapis.com/auth/tasks');
provider.addScope('https://www.googleapis.com/auth/chat.spaces.readonly');
provider.addScope('https://www.googleapis.com/auth/chat.messages.create');

// In-memory cache for OAuth access token (as required by Workspace Skill)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onSuccess?: (user: User, token: string | null) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onSuccess) onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string | null }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: any) {
    console.error('Firebase Auth sign in error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Firestore Project Persistence
export async function saveProjectToFirestore(
  project: ProjectRecord,
  user: User
): Promise<void> {
  try {
    const projectRef = doc(db, 'projects', project.id);
    await setDoc(projectRef, {
      id: project.id,
      name: project.name,
      description: project.description,
      userId: user.uid,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
      schema: project.schema || null
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore write warning (local state will persist):', err);
  }
}

export async function loadUserProjectsFromFirestore(userId: string): Promise<ProjectRecord[]> {
  try {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const results: ProjectRecord[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as ProjectRecord;
      results.push(data);
    });
    return results;
  } catch (err) {
    console.warn('Firestore read warning, falling back to local projects:', err);
    return [];
  }
}
