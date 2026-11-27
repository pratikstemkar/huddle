export type TourStep = {
  /** The `useTourTarget` id to point at. Steps whose target isn't on screen are skipped. */
  target: string;
  title: string;
  text: string;
};

/** Home: what each tab and button is for. */
export const HOME_STEPS: readonly TourStep[] = [
  { target: 'home.tab.index', title: 'Your trips', text: 'Every trip you’re in lives here. Each card says what the group is waiting on.' },
  { target: 'home.tab.groups', title: 'Groups', text: 'Your regular crews. Invites to trips and groups wait here too.' },
  { target: 'home.pip', title: 'Start a trip', text: 'Tap me any time to start one. Give it a name, then invite your people.' },
  { target: 'home.bell', title: 'Activity', text: 'Who joined, what got locked, and nudges from your group.' },
  { target: 'home.tab.profile', title: 'You', text: 'Your name, theme and notifications. You can replay this tour from here.' },
];

/** A trip: the usual order things happen in, from voting to photos. */
export function tripSteps(isOrganiser: boolean): TourStep[] {
  return [
    { target: 'trip.tab.index', title: 'The trip at a glance', text: 'Dates, where you’re going and who’s in. Pip’s card says what to do next.' },
    { target: 'trip.tab.vote', title: 'Vote first', text: 'Everyone marks the days they’re free and votes on where to go.' },
    ...(isOrganiser
      ? [{ target: 'trip.next', title: 'Lock it in', text: 'You’re the organiser: when the group agrees, lock in the dates and the place.' }]
      : []),
    {
      target: 'trip.tab.plan',
      title: 'Then plan the days',
      text: isOrganiser
        ? 'Once the dates are locked, add what you’re doing each day.'
        : 'Once the organiser locks the dates, add what you’re doing each day.',
    },
    { target: 'trip.tab.split', title: 'Split the costs', text: 'Log who paid for what. Huddle works out who owes whom.' },
    { target: 'trip.tab.photos', title: 'Share photos', text: 'One album for everyone’s photos from the trip.' },
    { target: 'trip.invite', title: 'Bring the group', text: 'Share a code or a link so everyone can join.' },
  ];
}
