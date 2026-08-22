export type proposalStatus = {
  id: number
  status: string
  color: string
}
export const proposalStatusList: proposalStatus[] = [
  {
    id: 0,
    status: 'UNSPECIFIED',
    color: 'gray',
  },
  {
    id: 1,
    status: 'DEPOSIT PERIOD',
    color: 'blue',
  },
  {
    id: 2,
    status: 'VOTING PERIOD',
    color: 'blue',
  },
  {
    id: 3,
    status: 'PASSED',
    color: 'green',
  },
  {
    id: 4,
    status: 'REJECTED',
    color: 'red',
  },
  {
    id: 5,
    status: 'FAILED',
    color: 'red',
  },
]

export type voteOption = {
  // Matches the wire value of cosmos.gov.v1.VoteOption exactly (confirmed
  // live: a VOTE_OPTION_YES vote's `proposal_vote` event carries
  // `option: [{"option":1,...}]`) — MsgVote/MsgVoteWeighted decode `option`
  // as this raw enum number, not a string, so lookups key on `id`.
  id: number
  option: string
  label: string
  color: string
}
export const voteOptionList: voteOption[] = [
  {
    id: 0,
    option: 'VOTE_OPTION_UNSPECIFIED',
    label: 'Unspecified',
    color: 'gray',
  },
  {
    id: 1,
    option: 'VOTE_OPTION_YES',
    label: 'Yes',
    color: 'green',
  },
  {
    id: 2,
    option: 'VOTE_OPTION_ABSTAIN',
    label: 'Abstain',
    color: 'gray',
  },
  {
    id: 3,
    option: 'VOTE_OPTION_NO',
    label: 'No',
    color: 'red',
  },
  {
    id: 4,
    option: 'VOTE_OPTION_NO_WITH_VETO',
    label: 'No with Veto',
    color: 'orange',
  },
]
