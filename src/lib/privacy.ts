/**
 * The privacy policy, as data, so the in-app page, the hosted web page (`/privacy`) and the store
 * listings all read the same words. Update `PRIVACY_UPDATED` whenever the text changes.
 *
 * Keep it true to the code: if a feature starts collecting something new (analytics, crash reports,
 * push tokens), it must be added here in the same change.
 */

/** Who runs Huddle and how to reach them. Fill these in before launch. */
export const PRIVACY_CONTROLLER = 'the Huddle team';
export const PRIVACY_CONTACT = 'privacy@example.com';

export const PRIVACY_UPDATED = '2026-11-14';

export type PrivacySection = { title: string; body: string[] };

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: 'What Huddle collects',
    body: [
      'Your account: the email address, name and profile photo that Google or Apple share when you sign in. With Apple you can choose to hide your email.',
      'What you add: the trips you create or join, the days you mark as free, the places you suggest (with any note, link or image link), your votes, and the name and avatar colour you set on your profile.',
      'To keep you signed in, your sign-in session is stored on your device and with our database provider.',
    ],
  },
  {
    title: 'What Huddle does not do',
    body: [
      'No ads, no advertising trackers and no analytics. We do not sell or rent your data, and we do not use it for anything other than running the app.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'People in a trip with you see your name, photo or avatar colour, the days you marked, the places you suggested and your votes in that trip. They cannot see trips you are not both in.',
      'Anyone holding a trip’s invite link can see the trip’s name, colour and how many people are in it, and nothing else.',
      'Images and links on suggested places load from the website they point to, which can see that your device requested them.',
    ],
  },
  {
    title: 'Where it is stored',
    body: [
      'Your data is stored with Supabase, our database and sign-in provider. Google or Apple handle the sign-in itself. The mobile app checks Expo’s update service for new versions, which sees your app version and device platform.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'For as long as you have an account. Leaving a trip removes your days and votes from it straight away.',
      'Delete your account from Your profile → Delete account. Your profile, days, votes and memberships are deleted at once. A trip you organise alone passes to its longest-standing member, and a trip with nobody else in it is deleted. Places you suggested stay in their trips without your name.',
    ],
  },
  {
    title: 'Your choices',
    body: [
      'You can change your name, photo and avatar colour on Your profile, leave any trip, and delete your account at any time.',
      `For a copy of your data or any other privacy question, email ${PRIVACY_CONTACT}.`,
    ],
  },
  {
    title: 'Children',
    body: ['Huddle is not meant for children under 13, and we do not knowingly collect their data.'],
  },
  {
    title: 'Changes',
    body: ['If this policy changes, the date at the top changes too. Big changes will be shown in the app before they apply.'],
  },
];
