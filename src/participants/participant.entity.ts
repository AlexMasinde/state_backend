import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Event } from '../event/event.entity';
import { User } from '../users/users.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  name: string;

  @Index({ unique: true })
  @Column()
  idNumber: string;

  @Column()
  group: string;

  @Column()
  origin: string;

  @Index()
  @Column({ default: false })
  checkedIn: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'checkedInBy' })
  checkedInBy: User;

  @Index()
  @ManyToOne(() => Event, (event) => event.participants)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Index()
  @Column()
  phoneNumber: string;

  @Column({ nullable: true, type: 'timestamp' })
  checkedInAt: Date;

  // Voter service fields (all optional)
  @Column({ nullable: true })
  county: string;

  @Column({ nullable: true })
  constituency: string;

  @Column({ nullable: true })
  ward: string;

  @Column({ nullable: true })
  pollingStation: string;

  @Column({ nullable: true, default: false })
  registeredVoter: boolean;

  @Column({ nullable: true })
  tribe: string;

  @Column({ nullable: true })
  clan: string;

  @Column({ nullable: true })
  family: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true, type: 'date' })
  dateOfBirth: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
