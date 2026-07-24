export type WriterSource = {
  id:string;
  source:string;
  verified:boolean;
};

export const writerSources: WriterSource[] = [
  {id:"tolstoy",source:"biographical database",verified:true},
  {id:"dostoevsky",source:"biographical database",verified:true},
  {id:"shakespeare",source:"biographical database",verified:true}
];
