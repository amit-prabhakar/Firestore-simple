import {
  CollectionReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QuerySnapshot,
} from '@google-cloud/firestore'
import { Assign } from 'utility-types'

interface HasId { id: string, [prop: string]: any }
interface NullableId { id?: string }
export declare interface ISetOptions { [key: string]: string }
export class FirestoreSimple<T extends HasId> {
  public firestore: Firestore
  public collectionRef: CollectionReference
  public _encode?: (obj: T | Assign<T, NullableId>) => FirebaseFirestore.DocumentData
  public _decode?: (doc: HasId) => T

  constructor ({ firestore, path, encode, decode }: {
    firestore: Firestore,
    path: string,
    encode?: (obj: T | Assign<T, NullableId>) => FirebaseFirestore.DocumentData
    decode?: (doc: HasId) => T,
  }) {
    this.firestore = firestore,
    this.collectionRef = this.firestore.collection(path)
    this._encode = encode
    this._decode = decode
  }
  // for overwrite in subclass
  public decode (doc: HasId): T {
    if (this._decode) return this._decode(doc)
    return doc as T
  }

  public toObject (documentSnapshot: DocumentSnapshot): T {
    const obj = { id: documentSnapshot.id, ...documentSnapshot.data() }
    return this.decode(obj)
  }

  // for overwrite in subclass
  public encode (obj: T | Assign<T, NullableId>) {
    if (this._encode) return this._encode(obj)
    return Object.assign({}, obj)
  }

  public toDoc (obj: T | Assign<T, NullableId>) {
    const doc = this.encode(obj)
    if (doc.id) delete doc.id
    return doc
  }

  public async fetch (id: string): Promise <T | undefined> {
    const snapshot = await this.collectionRef.doc(id).get()
    if (!snapshot.exists) return undefined

    return this.toObject(snapshot)
  }

  // for v1 API compatibility
  public async fetchDocument (id: string): Promise<T | undefined> {
    return this.fetch(id)
  }

  public async fetchAll (): Promise<T[]> {
    const snapshot = await this.collectionRef.get()
    const arr: T[] = []

    snapshot.forEach((documentSnapshot) => {
      arr.push(this.toObject(documentSnapshot))
    })
    return arr
  }

  // for v1 API compatibility
  public async fetchCollection (): Promise<T[]> {
    return this.fetchAll()
  }

  public async add (obj: Assign<T, NullableId>): Promise <T> {
    const doc = this.toDoc(obj)
    const docRef = await this.collectionRef.add(doc)
    return Object.assign({}, obj, { id: docRef.id }) as unknown as T
  }

  public async set (obj: T, setOptions?: ISetOptions) {
    if (!obj.id) throw new Error('Argument object must have "id" property')

    const docId = obj.id
    const setDoc = this.toDoc(obj)

    await this.collectionRef.doc(docId).set(setDoc, setOptions)
    return obj
  }

  public addOrSet (obj: Assign<T, NullableId> | T) {
    if ('id' in obj && typeof obj.id === 'string') {
      return this.set(obj)
    }
    return this.add(obj as Assign<T, NullableId>)
  }

  public async delete (id: string) {
    await this.collectionRef.doc(id).delete()
    return id
  }

  public async bulkSet (objects: T[]) {
    const batch = this.firestore.batch()

    objects.forEach((obj) => {
      const docId = obj.id
      const setDoc = this.toDoc(obj)
      batch.set(this.collectionRef.doc(docId), setDoc)
    })
    return batch.commit()
  }

  public async bulkDelete (docIds: string[]) {
    const batch = this.firestore.batch()

    docIds.forEach((docId) => {
      batch.delete(this.collectionRef.doc(docId))
    })
    return batch.commit()
  }

  public async fetchByQuery (query: Query) {
    const snapshot = await query.get()
    const arr: T[] = []

    snapshot.forEach((documentSnapshot) => {
      arr.push(this.toObject(documentSnapshot))
    })
    return arr
  }

  public where (fieldPath: string | FirebaseFirestore.FieldPath, opStr: FirebaseFirestore.WhereFilterOp, value: any) {
    const query = new FirestoreSimpleQuery<T>({ firestoreSimple: this })
    return query.where(fieldPath, opStr, value)
  }

  public orderBy (fieldPath: string | FirebaseFirestore.FieldPath, directionStr?: FirebaseFirestore.OrderByDirection) {
    const query = new FirestoreSimpleQuery<T>({ firestoreSimple: this })
    return query.orderBy(fieldPath, directionStr)
  }

  public limit (limit: number) {
    const query = new FirestoreSimpleQuery<T>({ firestoreSimple: this })
    return query.limit(limit)
  }

  public onSnapshot (callback: (
    querySnapshot: QuerySnapshot,
    toObject: (documentSnapshot: DocumentSnapshot) => T,
    ) => void) {
    return this.collectionRef.onSnapshot((_querySnapshot) => {
      callback(_querySnapshot, this.toObject.bind(this))
    })
  }
}

class FirestoreSimpleQuery<T extends HasId> {
  public firestoreSimple: FirestoreSimple<T>
  public query?: Query
  constructor ({ firestoreSimple }: { firestoreSimple: FirestoreSimple<T> }) {
    this.firestoreSimple = firestoreSimple
    this.query = undefined
  }

  public where (fieldPath: string | FirebaseFirestore.FieldPath, opStr: FirebaseFirestore.WhereFilterOp, value: any) {
    if (!this.query) {
      this.query = this.firestoreSimple.collectionRef.where(fieldPath, opStr, value)
    } else {
      this.query = this.query.where(fieldPath, opStr, value)
    }
    return this
  }

  public orderBy (fieldPath: string | FirebaseFirestore.FieldPath, directionStr?: FirebaseFirestore.OrderByDirection) {
    if (!this.query) {
      this.query = this.firestoreSimple.collectionRef.orderBy(fieldPath, directionStr)
    } else {
      this.query = this.query.orderBy(fieldPath, directionStr)
    }
    return this
  }

  public limit (limit: number) {
    if (!this.query) {
      this.query = this.firestoreSimple.collectionRef.limit(limit)
    } else {
      this.query = this.query.limit(limit)
    }
    return this
  }

  public async get () {
    if (this.query == null) throw new Error('no query statement before get()')

    return this.firestoreSimple.fetchByQuery(this.query)
  }

  public onSnapshot (callback: (
    querySnapshot: QuerySnapshot,
    toObject: (documentSnapshot: DocumentSnapshot) => T,
    ) => void) {
    return this.firestoreSimple.onSnapshot(callback)
  }
}
