import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  getRepository
} from 'typeorm';
import User from './User';
import DataLoader from 'dataloader';
import { normalize } from '../lib/utils';

@Entity('user_profiles', {
  synchronize: true
})
export default class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  display_name!: string;

  @Column({ length: 255 })
  short_bio!: string;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  thumbnail!: string | null;

  @Column('timestampz')
  @CreateDateColumn()
  created_at!: Date;

  @Column('timestamptz')
  @UpdateDateColumn()
  updated_at!: Date;

  @OneToOne(type => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fk_user_id' })
  user!: User;

  @Column('uuid')
  fk_user_id!: string;
}

export const createUserProfileLoader = () =>
  new DataLoader<string, UserProfile>(async userIds => {
    const repo = getRepository(UserProfile);
    const profiles = await repo
      .createQueryBuilder('user_profiles')
      .where('fk_user_id IN (:...userIds)', { userIds })
      .getMany();

    const normalized = normalize(profiles, profile => profile.fk_user_id);
    const ordered = userIds.map(id => normalized[id]);
    return ordered;
  });
