import {
  handlerIdentity,
  officeIdentity,
  organizationOptions,
  workIdentityAt,
} from './tracking-organization';
const at = new Date('2026-10-27T03:00:00.000Z');
const version = (id = 11, parentVersionId: number | null = null) => ({
  id,
  parentVersionId,
  nameKh: 'Specialist office',
  nameEn: 'Specialist office',
  effectiveFrom: new Date('2026-01-01'),
  effectiveTo: null as Date | null,
  MinistryVersion: { nameKh: 'Civil service', nameEn: 'Civil service' },
});
const office = () => ({
  id: 1,
  code: 'OFFICE',
  isEnabled: true,
  Versions: [version()],
});
const employment = () => ({
  id: 21,
  profileId: 31,
  positionTitle: 'Document officer',
  status: 'ACTIVE' as const,
  startDate: new Date('2026-01-01'),
  endDate: null as Date | null,
  DepartmentVersion: { departmentId: 1, Department: office() },
});
const person = () => ({
  id: 1,
  name: 'Account name',
  image: null,
  profile: {
    id: 31,
    firstName: 'First',
    lastName: 'Last',
    isEnabled: true,
    isHold: false,
    status: 'ACTIVE' as const,
    CurrentEmployment: employment(),
    Employments: [employment()],
  },
});
it('reuses the current employment and resolves current organization display', () =>
  expect(handlerIdentity(person(), at)).toMatchObject({
    profileName: 'Last First',
    positionTitle: 'Document officer',
    employmentId: 21,
    departmentId: 1,
    departmentVersionId: 11,
    departmentName: 'Specialist office',
    ministryName: 'Civil service',
  }));
it('does not expose raw profile, salary or identity fields', () =>
  expect(Object.keys(handlerIdentity(person(), at))).not.toEqual(
    expect.arrayContaining([
      'profile',
      'nationalId',
      'salaryGrade',
      'dob',
      'email',
    ]),
  ));
it('falls back from a stale shortcut to an effective assignment', () => {
  const user = person();
  user.profile.CurrentEmployment = {
    ...employment(),
    id: 99,
    endDate: new Date('2026-10-26'),
  };
  expect(handlerIdentity(user, at).employmentId).toBe(21);
});
it('rejects future appointments and pointers belonging to a different profile', () => {
  const user = person();
  user.profile.CurrentEmployment = { ...employment(), profileId: 99 };
  user.profile.Employments = [
    { ...employment(), startDate: new Date('2027-01-01') },
  ];
  expect(handlerIdentity(user, at).employmentId).toBeNull();
});
it('does not auto-route a held or disabled profile', () => {
  const user = person();
  user.profile.isHold = true;
  expect(handlerIdentity(user, at).departmentId).toBeNull();
  user.profile.isHold = false;
  user.profile.isEnabled = false;
  expect(handlerIdentity(user, at).departmentId).toBeNull();
});
it('supports users without an HR profile', () =>
  expect(handlerIdentity({ ...person(), profile: null }, at)).toMatchObject({
    name: 'Account name',
    departmentId: null,
    positionTitle: null,
  }));
it('uses the current legal office version rather than a future rename', () => {
  const current = office();
  current.Versions.unshift({
    ...version(12),
    nameKh: 'Future office',
    effectiveFrom: new Date('2027-01-01'),
  });
  expect(officeIdentity(current, at).departmentName).toBe('Specialist office');
});
it('displays ministry and department ancestry without creating duplicate organizations', () => {
  const parent = {
    ...office(),
    id: 2,
    Versions: [{ ...version(10), nameKh: 'General secretariat' }],
  };
  const child = { ...office(), Versions: [version(11, 10)] };
  expect(organizationOptions([parent, child], at)[1].name).toBe(
    'Civil service · General secretariat / Specialist office',
  );
});
it('does not derive a disabled receiving office', () =>
  expect(
    officeIdentity({ ...office(), isEnabled: false }, at).departmentId,
  ).toBeNull());
it('uses Cambodia business dates for date-only HR appointments', () => {
  const user = person();
  user.profile.CurrentEmployment.startDate = new Date('2026-10-27');
  expect(
    handlerIdentity(user, new Date('2026-10-26T18:00:00Z')).employmentId,
  ).toBe(21);
});
it('limits fallback queries to effective employment windows', () =>
  expect(workIdentityAt(at).profile.select.Employments.where).toMatchObject({
    startDate: { lte: new Date('2026-10-27T00:00:00Z') },
    OR: [
      { endDate: null },
      { endDate: { gte: new Date('2026-10-27T00:00:00Z') } },
    ],
  }));
