/** Lagret firmaliste — én modell for Skann og Smartliste. */
export type ListKind = "static" | "dynamic";

export type CompanyList = {
  id: string;
  userId: string;
  name: string;
  kind: ListKind;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ListMember = {
  orgnr: string;
  listId: string;
  addedAt?: string;
  laneId?: string | null;
  sortOrder?: number;
};

export type ListMembersResponse = {
  listId: string;
  name: string;
  orgnrs: string[];
  members: ListMember[];
};
