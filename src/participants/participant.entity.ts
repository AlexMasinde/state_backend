import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from '../event/event.entity';
import { User } from '../users/users.entity';

@Entity('participants')
export class Participant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  idNumber: string;

  @Column()
  group: string;

  @Column()
  origin: string;

  @Column({ default: false })
  checkedIn: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'checkedInBy' })
  checkedInBy: User;

  @ManyToOne(() => Event, (event) => event.participants)
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  phoneNumber: string;

  @Column({ nullable: true, type: 'timestamp' })
  checkedInAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
