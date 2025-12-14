export interface WritingAssignmentListItem {
    id?: number;
    firstName : string;
    lastName : string;
    scripture : string;
    infraction : string;
    issuedBy : string;
    dateIssued : Date;
    dateDue : Date;
    isComplete : boolean;
    demerits : number;
}