export interface WritingAssignmentListItem {
    id: number;
    firstName : string;
    lastName : string;
    scripture : string;
    infraction : string;
    issuedBy : string;
    dateIssued : Date | string;
    dateDue : Date | string;
    isComplete : boolean;
    demerits : number;
}