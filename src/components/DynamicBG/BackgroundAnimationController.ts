export interface TimeInterval {
    start: number;
    duration: number;
    confidence: number;
}

export interface Section extends TimeInterval {
    loudness: number;
    tempo: number;
    key: number;
    mode: number;
    time_signature: number;
}

export interface Beat extends TimeInterval {}

export interface Segment extends TimeInterval {
    loudness_start: number;
    loudness_max_time: number;
    loudness_max: number;
    loudness_end?: number;
}

export interface TrackData {
    tempo: number;
    loudness: number;
    duration: number;
}

export interface AudioAnalysisData {
    track: TrackData;
    sections: Section[];
    beats: Beat[];
    segments: Segment[];
}

export class BackgroundAnimationController {
    private readonly BASE_TEMPO = 120.0;
    private readonly BEAT_PULSE_MAX = 1.5;
    private readonly BEAT_PULSE_DECAY = 5.0;
    private readonly MIN_BEAT_CONFIDENCE = 0.4;

    // Beat-driven motion: a slower drift between beats and a bigger, longer kick on each
    // one, so the speed visibly swings with the music.
    private readonly DRIVEN_RESTING_FACTOR = 0.55;
    private readonly DRIVEN_BEAT_PULSE_MAX = 2.6;
    private readonly DRIVEN_BEAT_PULSE_DECAY = 3.5;
    private readonly DRIVEN_MAX_SPEED = 3.5;

    /**
     * Finds the active element in a time-based array (Sections, Beats, Segments)
     */
    private getActiveElement<T extends TimeInterval>(elements: T[], currentTime: number): T | null {
        return elements.find(el => 
            currentTime >= el.start && currentTime < (el.start + el.duration)
        ) || null;
    }

    /**
     * Maps a loudness dB value (usually -60 to 0) to a usable multiplier
     * Example: -40dB -> ~0.5, 0dB -> 1.2
     */
    private getLoudnessFactor(dB: number): number {
        const normalized = Math.max(0, (dB + 40) / 40); 
        return 0.5 + (normalized * 0.7);
    }

    /**
     * Calculates the dynamic speed multiplier for the current frame
     * * @param currentTime Current playback time of the song in seconds
     * @param data The parsed audio analysis JSON object
     * @param beatDriven Widen the swing: slower between beats, faster on them
     * @returns A float multiplier (e.g., 1.0 is normal, 2.5 is very fast, 0.5 is slow)
     */
    public getSpeedMultiplier(currentTime: number, data: AudioAnalysisData, beatDriven = false): number {
        let currentSpeed = 1.0;

        const currentSection = this.getActiveElement(data.sections, currentTime);
        if (currentSection) {
            const tempoMultiplier = currentSection.tempo / this.BASE_TEMPO;
            const loudnessMultiplier = this.getLoudnessFactor(currentSection.loudness);
            
            currentSpeed = tempoMultiplier * loudnessMultiplier;
        } else {
            currentSpeed = (data.track.tempo / this.BASE_TEMPO) * this.getLoudnessFactor(data.track.loudness);
        }

        if (beatDriven) currentSpeed *= this.DRIVEN_RESTING_FACTOR;

        const currentBeat = this.getActiveElement(data.beats, currentTime);
        if (currentBeat && currentBeat.confidence > this.MIN_BEAT_CONFIDENCE) {
            const progressIntoBeat = (currentTime - currentBeat.start) / currentBeat.duration;
            const decayRate = beatDriven ? this.DRIVEN_BEAT_PULSE_DECAY : this.BEAT_PULSE_DECAY;
            const pulseMax = beatDriven ? this.DRIVEN_BEAT_PULSE_MAX : this.BEAT_PULSE_MAX;
            const pulseDecay = Math.exp(-decayRate * progressIntoBeat);
            const beatPulseAddition = pulseMax * pulseDecay * currentBeat.confidence;

            currentSpeed += beatPulseAddition;
        }

        // add tiny high-speed jitters for sharp sounds (snares, synths)
        /* const currentSegment = this.getActiveElement(data.segments, currentTime);
        if (currentSegment) {
            if (currentSegment.loudness_max > -10 && currentSegment.loudness_max_time < 0.05) {
                currentSpeed += 0.25; 
            }
        } */

        return Math.max(0.1, Math.min(currentSpeed, beatDriven ? this.DRIVEN_MAX_SPEED : 3.0));
    }
}