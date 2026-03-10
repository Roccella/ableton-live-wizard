from __future__ import absolute_import, print_function, unicode_literals

# Derived from the MIT-licensed ableton-mcp project by Siddharth Ahuja.

import json
import queue
import socket
import threading
import traceback

from _Framework.ControlSurface import ControlSurface

HOST = "127.0.0.1"
DEFAULT_PORT = 9877


def create_instance(c_instance):
    return AbletonMCP(c_instance)


class AbletonMCP(ControlSurface):
    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)
        self._song = self.song()
        self.server = None
        self.server_thread = None
        self.client_threads = []
        self.running = False

        self.log_message("AbletonMCP remote script starting")
        self.start_server()
        self.show_message("AbletonMCP: listening on {0}:{1}".format(HOST, DEFAULT_PORT))

    def disconnect(self):
        self.running = False

        if self.server:
            try:
                self.server.close()
            except Exception:
                pass

        if self.server_thread and self.server_thread.is_alive():
            self.server_thread.join(1.0)

        for thread in self.client_threads[:]:
            if thread.is_alive():
                self.log_message("Client thread still alive on disconnect")

        ControlSurface.disconnect(self)
        self.log_message("AbletonMCP remote script stopped")

    def start_server(self):
        try:
            self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server.bind((HOST, DEFAULT_PORT))
            self.server.listen(5)
            self.running = True
            self.server_thread = threading.Thread(target=self._server_loop)
            self.server_thread.daemon = True
            self.server_thread.start()
        except Exception as exc:
            self.log_message("Error starting server: {0}".format(str(exc)))
            self.show_message("AbletonMCP start error: {0}".format(str(exc)))

    def _server_loop(self):
        try:
            self.server.settimeout(1.0)
            while self.running:
                try:
                    client, address = self.server.accept()
                    self.log_message("Client connected: {0}".format(address))
                    thread = threading.Thread(target=self._handle_client, args=(client,))
                    thread.daemon = True
                    thread.start()
                    self.client_threads.append(thread)
                    self.client_threads = [item for item in self.client_threads if item.is_alive()]
                except socket.timeout:
                    continue
                except Exception as exc:
                    if self.running:
                        self.log_message("Accept error: {0}".format(str(exc)))
        except Exception as exc:
            self.log_message("Server loop error: {0}".format(str(exc)))

    def _handle_client(self, client):
        buffer = ""
        try:
            while self.running:
                data = client.recv(8192)
                if not data:
                    break

                buffer += data.decode("utf-8")
                if "\n" not in buffer:
                    continue
                line, buffer = buffer.split("\n", 1)
                command = json.loads(line)

                response = self._process_command(command)
                client.sendall(json.dumps(response).encode("utf-8") + b"\n")
        except Exception as exc:
            self.log_message("Client handler error: {0}".format(str(exc)))
            self.log_message(traceback.format_exc())
            try:
                client.sendall(json.dumps({"status": "error", "message": str(exc)}).encode("utf-8") + b"\n")
            except Exception:
                pass
        finally:
            try:
                client.close()
            except Exception:
                pass

    def _process_command(self, command):
        command_type = command.get("type", "")
        params = command.get("params", {}) or {}
        self.log_message("Command start ({0}) params={1}".format(command_type, json.dumps(params)))

        mutating_commands = {
            "create_midi_track",
            "delete_track",
            "set_track_name",
            "create_scene",
            "delete_scene",
            "set_scene_name",
            "create_clip",
            "delete_clip",
            "add_notes_to_clip",
            "fire_clip",
            "fire_scene",
            "load_browser_item",
            "undo",
            "redo",
            "start_playback",
            "stop_playback",
            "set_tempo",
        }

        try:
            result = self._run_on_main_thread(
                lambda: self._execute_mutating(command_type, params)
                if command_type in mutating_commands
                else self._execute_read(command_type, params)
            )
            self.log_message("Command success ({0})".format(command_type))
            return {"status": "success", "result": result}
        except Exception as exc:
            self.log_message("Command error ({0}): {1}".format(command_type, str(exc)))
            self.log_message(traceback.format_exc())
            return {"status": "error", "message": str(exc)}

    def _run_on_main_thread(self, fn):
        result_queue = queue.Queue()

        def task():
            try:
                result_queue.put(("ok", fn()))
            except Exception as exc:
                result_queue.put(("error", exc))

        try:
            self.schedule_message(0, task)
        except AssertionError:
            task()

        status, payload = result_queue.get(timeout=10.0)
        if status == "error":
            raise payload
        return payload

    def _execute_read(self, command_type, params):
        if command_type == "get_full_state":
            return self._get_full_state()
        if command_type == "get_session_info":
            return self._get_session_info()
        if command_type == "get_track_info":
            return self._get_track_info(int(params.get("track_index", 0)))
        if command_type == "get_clip_notes":
            return self._get_clip_notes(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
            )
        if command_type == "get_browser_items_at_path":
            return self.get_browser_items_at_path(params.get("path", ""))
        raise ValueError("Unknown command: {0}".format(command_type))

    def _execute_mutating(self, command_type, params):
        if command_type == "create_midi_track":
            return self._create_midi_track(int(params.get("index", -1)))
        if command_type == "delete_track":
            return self._delete_track(int(params.get("track_index", 0)))
        if command_type == "set_track_name":
            return self._set_track_name(int(params.get("track_index", 0)), params.get("name", ""))
        if command_type == "create_scene":
            return self._create_scene(int(params.get("index", -1)), params.get("name", ""))
        if command_type == "delete_scene":
            return self._delete_scene(int(params.get("scene_index", 0)))
        if command_type == "set_scene_name":
            return self._set_scene_name(int(params.get("scene_index", 0)), params.get("name", ""))
        if command_type == "create_clip":
            return self._create_clip(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
                float(params.get("length", 4.0)),
            )
        if command_type == "delete_clip":
            return self._delete_clip(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
            )
        if command_type == "add_notes_to_clip":
            return self._add_notes_to_clip(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
                params.get("notes", []),
            )
        if command_type == "rewrite_clip_notes":
            return self._rewrite_clip_notes(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
                float(params.get("length", 4.0)),
                params.get("notes", []),
            )
        if command_type == "fire_clip":
            return self._fire_clip(
                int(params.get("track_index", 0)),
                int(params.get("clip_index", 0)),
            )
        if command_type == "fire_scene":
            return self._fire_scene(int(params.get("scene_index", 0)))
        if command_type == "load_browser_item":
            return self._load_browser_item(
                int(params.get("track_index", 0)),
                params.get("item_uri", ""),
            )
        if command_type == "undo":
            return self._undo()
        if command_type == "redo":
            return self._redo()
        if command_type == "start_playback":
            return self._start_playback()
        if command_type == "stop_playback":
            return self._stop_playback()
        if command_type == "set_tempo":
            return self._set_tempo(float(params.get("bpm", self._song.tempo)))
        raise ValueError("Unknown command: {0}".format(command_type))

    def _get_full_state(self):
        tracks = []
        for index in range(len(self._song.tracks)):
            tracks.append(self._get_track_info(index))

        scenes = []
        for index, scene in enumerate(self._song.scenes):
            scenes.append(
                {
                    "index": index,
                    "name": scene.name,
                    "is_triggered": getattr(scene, "is_triggered", False),
                }
            )

        selected_track_index = self._get_selected_track_index()
        selected_scene_index = self._get_selected_scene_index()
        selected_clip_coords = self._get_highlighted_clip_slot_coords()

        return {
            "tempo": self._song.tempo,
            "signature_numerator": self._song.signature_numerator,
            "signature_denominator": self._song.signature_denominator,
            "is_playing": self._song.is_playing,
            "tracks": tracks,
            "scenes": scenes,
            "selected_track_index": selected_track_index,
            "selected_scene_index": selected_scene_index,
            "selected_clip_track_index": selected_clip_coords.get("track_index") if selected_clip_coords else None,
            "selected_clip_index": selected_clip_coords.get("clip_index") if selected_clip_coords else None,
        }

    def _get_session_info(self):
        tracks = []
        for index, track in enumerate(self._song.tracks):
            tracks.append(
                {
                    "index": index,
                    "name": track.name,
                    "is_midi_track": track.has_midi_input,
                    "is_audio_track": track.has_audio_input,
                }
            )

        return {
            "tempo": self._song.tempo,
            "signature_numerator": self._song.signature_numerator,
            "signature_denominator": self._song.signature_denominator,
            "is_playing": self._song.is_playing,
            "track_count": len(self._song.tracks),
            "return_track_count": len(self._song.return_tracks),
            "tracks": tracks,
        }

    def _get_track_info(self, track_index):
        track = self._require_track(track_index)
        clip_slots = []
        for slot_index, slot in enumerate(track.clip_slots):
            clip_info = None
            if slot.has_clip:
                clip_info = {
                    "name": slot.clip.name,
                    "length": slot.clip.length,
                    "is_playing": slot.clip.is_playing,
                    "is_recording": slot.clip.is_recording,
                    "notes": self._read_clip_notes(slot.clip),
                }
            clip_slots.append({"index": slot_index, "has_clip": slot.has_clip, "clip": clip_info})

        devices = []
        for device_index, device in enumerate(track.devices):
            devices.append(
                {
                    "index": device_index,
                    "name": device.name,
                    "class_name": device.class_name,
                    "type": self._get_device_type(device),
                }
            )

        return {
            "index": track_index,
            "name": track.name,
            "is_audio_track": track.has_audio_input,
            "is_midi_track": track.has_midi_input,
            "mute": track.mute,
            "solo": track.solo,
            "arm": track.arm,
            "clip_slots": clip_slots,
            "devices": devices,
        }

    def _create_midi_track(self, index):
        insert_index = index if index != -1 else self._get_default_track_insert_index()
        self._song.create_midi_track(insert_index)
        new_track_index = len(self._song.tracks) - 1 if insert_index == -1 else insert_index
        new_track = self._song.tracks[new_track_index]
        self._song.view.selected_track = new_track
        return {"index": new_track_index, "name": new_track.name}

    def _delete_track(self, track_index):
        track = self._require_track(track_index)
        track_name = track.name

        if hasattr(self._song, "delete_track"):
            self._song.delete_track(track_index)
        elif hasattr(self._song, "remove_track"):
            self._song.remove_track(track_index)
        else:
            raise RuntimeError("Live API does not expose delete_track/remove_track")

        return {"deleted": True, "index": track_index, "name": track_name}

    def _set_track_name(self, track_index, name):
        track = self._require_track(track_index)
        track.name = name
        return {"index": track_index, "name": track.name}

    def _create_scene(self, index, name):
        if hasattr(self._song, "create_scene"):
            self._song.create_scene(index)
        elif hasattr(self._song, "insert_scene"):
            self._song.insert_scene(index)
        else:
            raise RuntimeError("Live API does not expose create_scene/insert_scene")

        new_scene_index = len(self._song.scenes) - 1 if index == -1 else index
        scene = self._require_scene(new_scene_index)
        if name:
            scene.name = name
        return {"index": new_scene_index, "name": scene.name}

    def _delete_scene(self, scene_index):
        scene = self._require_scene(scene_index)
        scene_name = scene.name

        if hasattr(self._song, "delete_scene"):
            self._song.delete_scene(scene_index)
        elif hasattr(self._song, "remove_scene"):
            self._song.remove_scene(scene_index)
        else:
            raise RuntimeError("Live API does not expose delete_scene/remove_scene")

        return {"deleted": True, "index": scene_index, "name": scene_name}

    def _set_scene_name(self, scene_index, name):
        scene = self._require_scene(scene_index)
        scene.name = name
        return {"index": scene_index, "name": scene.name}

    def _create_clip(self, track_index, clip_index, length):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if clip_slot.has_clip:
            raise RuntimeError("Clip slot already has a clip")

        clip_slot.create_clip(length)
        return {"name": clip_slot.clip.name, "length": clip_slot.clip.length}

    def _delete_clip(self, track_index, clip_index):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if not clip_slot.has_clip:
            raise RuntimeError("No clip in slot")

        clip_name = clip_slot.clip.name
        clip_slot.delete_clip()
        return {"deleted": True, "track_index": track_index, "clip_index": clip_index, "name": clip_name}

    def _add_notes_to_clip(self, track_index, clip_index, notes):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if not clip_slot.has_clip:
            raise RuntimeError("No clip in slot")

        live_notes = []
        for note in notes:
            live_notes.append(
                (
                    int(note.get("pitch", 60)),
                    float(note.get("start_time", 0.0)),
                    float(note.get("duration", 0.25)),
                    int(note.get("velocity", 100)),
                    bool(note.get("mute", False)),
                )
            )

        clip_slot.clip.set_notes(tuple(live_notes))
        return {"note_count": len(live_notes)}

    def _rewrite_clip_notes(self, track_index, clip_index, length, notes):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if not clip_slot.has_clip:
            raise RuntimeError("Clip slot does not contain a clip")

        clip = clip_slot.clip
        try:
            clip.loop_end = length
        except Exception:
            pass
        try:
            clip.end_marker = length
        except Exception:
            pass
        try:
            clip.remove_notes(0.0, 0, length, 128)
        except Exception:
            pass

        live_notes = []
        for note in notes:
            live_notes.append(
                (
                    int(note.get("pitch", 60)),
                    float(note.get("start_time", 0.0)),
                    float(note.get("duration", 0.25)),
                    int(note.get("velocity", 100)),
                    bool(note.get("mute", False)),
                )
            )

        clip.set_notes(tuple(live_notes))
        return {"note_count": len(live_notes), "length": length}

    def _get_clip_notes(self, track_index, clip_index):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if not clip_slot.has_clip:
            raise RuntimeError("Clip slot does not contain a clip")

        clip = clip_slot.clip
        return {
            "name": clip.name,
            "length": clip.length,
            "is_playing": clip.is_playing,
            "notes": self._read_clip_notes(clip),
        }

    def _read_clip_notes(self, clip):
        try:
            if hasattr(clip, "is_midi_clip") and not clip.is_midi_clip:
                return []
        except Exception:
            pass

        length = float(getattr(clip, "length", 0.0))
        raw_notes = []

        try:
            raw_notes = clip.get_notes(0.0, 0, length, 128)
        except Exception:
            try:
                raw_notes = clip.get_notes_extended(0.0, 0, length, 128)
            except Exception:
                return []

        notes = []
        for note in raw_notes:
            normalized = self._normalize_note_tuple(note)
            if normalized is not None:
                notes.append(normalized)
        return notes

    def _normalize_note_tuple(self, note):
        if isinstance(note, dict):
            try:
                return {
                    "pitch": int(note.get("pitch", 60)),
                    "start_time": float(note.get("start_time", 0.0)),
                    "duration": float(note.get("duration", 0.25)),
                    "velocity": int(note.get("velocity", 100)),
                }
            except Exception:
                return None

        try:
            pitch = int(note[0])
            start_time = float(note[1])
            duration = float(note[2])
            velocity = int(note[3])
            return {
                "pitch": pitch,
                "start_time": start_time,
                "duration": duration,
                "velocity": velocity,
            }
        except Exception:
            return None

    def _undo(self):
        if hasattr(self._song, "can_undo") and hasattr(self._song, "undo"):
            if not self._song.can_undo:
                raise RuntimeError("Nothing to undo")
            self._song.undo()
            return {"undone": True}

        app = self.application()
        if hasattr(app, "undo"):
            app.undo()
            return {"undone": True}

        raise RuntimeError("Undo is not available in this Live runtime")

    def _redo(self):
        if hasattr(self._song, "can_redo") and hasattr(self._song, "redo"):
            if not self._song.can_redo:
                raise RuntimeError("Nothing to redo")
            self._song.redo()
            return {"redone": True}

        app = self.application()
        if hasattr(app, "redo"):
            app.redo()
            return {"redone": True}

        raise RuntimeError("Redo is not available in this Live runtime")

    def _start_playback(self):
        self._song.start_playing()
        return {"is_playing": self._song.is_playing}

    def _stop_playback(self):
        self._song.stop_playing()
        return {"is_playing": self._song.is_playing}

    def _set_tempo(self, bpm):
        self._song.tempo = float(bpm)
        return {"bpm": self._song.tempo}

    def _fire_clip(self, track_index, clip_index):
        track = self._require_track(track_index)
        if clip_index < 0 or clip_index >= len(track.clip_slots):
            raise IndexError("Clip index out of range")

        clip_slot = track.clip_slots[clip_index]
        if not clip_slot.has_clip:
            raise RuntimeError("No clip in slot")

        clip_slot.fire()
        return {"fired": True, "track_index": track_index, "clip_index": clip_index}

    def _fire_scene(self, scene_index):
        scene = self._require_scene(scene_index)
        scene.fire()
        return {"fired": True, "scene_index": scene_index, "name": scene.name}

    def _load_browser_item(self, track_index, item_uri):
        track = self._require_track(track_index)
        app = self.application()
        item = self._find_browser_item_by_uri(app.browser, item_uri)
        if not item:
            raise RuntimeError("Browser item not found for URI: {0}".format(item_uri))

        self._song.view.selected_track = track
        app.browser.load_item(item)
        return {"loaded": True, "item_name": item.name, "uri": item_uri}

    def _find_browser_item_by_uri(self, browser_or_item, uri, depth=0, max_depth=8):
        if depth > max_depth:
            return None

        if hasattr(browser_or_item, "uri") and browser_or_item.uri == uri:
            return browser_or_item

        if hasattr(browser_or_item, "children") and browser_or_item.children:
            for child in browser_or_item.children:
                found = self._find_browser_item_by_uri(child, uri, depth + 1, max_depth)
                if found:
                    return found

        if depth == 0:
            for attr in ["instruments", "sounds", "drums", "audio_effects", "midi_effects"]:
                if hasattr(browser_or_item, attr):
                    found = self._find_browser_item_by_uri(getattr(browser_or_item, attr), uri, depth + 1, max_depth)
                    if found:
                        return found

        return None

    def get_browser_items_at_path(self, path):
        app = self.application()
        if not app or not hasattr(app, "browser") or app.browser is None:
            raise RuntimeError("Browser is not available")

        parts = [item for item in path.split("/") if item]
        if not parts:
            raise ValueError("Invalid path")

        root_name = parts[0].lower()
        root_map = {
            "instruments": "instruments",
            "sounds": "sounds",
            "drums": "drums",
            "audio_effects": "audio_effects",
            "midi_effects": "midi_effects",
        }

        root_attr = root_map.get(root_name, root_name)
        if not hasattr(app.browser, root_attr):
            return {
                "path": path,
                "error": "Unknown or unavailable category: {0}".format(root_name),
                "items": [],
            }

        current_item = getattr(app.browser, root_attr)
        for part in parts[1:]:
            if not hasattr(current_item, "children"):
                return {"path": path, "error": "Item has no children", "items": []}
            next_item = None
            for child in current_item.children:
                if hasattr(child, "name") and child.name.lower() == part.lower():
                    next_item = child
                    break
            if not next_item:
                return {"path": path, "error": "Path part '{0}' not found".format(part), "items": []}
            current_item = next_item

        items = []
        if hasattr(current_item, "children"):
            for child in current_item.children:
                items.append(
                    {
                        "name": child.name if hasattr(child, "name") else "Unknown",
                        "is_folder": hasattr(child, "children") and bool(child.children),
                        "is_device": hasattr(child, "is_device") and child.is_device,
                        "is_loadable": hasattr(child, "is_loadable") and child.is_loadable,
                        "uri": child.uri if hasattr(child, "uri") else None,
                    }
                )

        return {
            "path": path,
            "name": current_item.name if hasattr(current_item, "name") else "Unknown",
            "uri": current_item.uri if hasattr(current_item, "uri") else None,
            "is_folder": hasattr(current_item, "children") and bool(current_item.children),
            "is_loadable": hasattr(current_item, "is_loadable") and current_item.is_loadable,
            "items": items,
        }

    def _require_track(self, track_index):
        if track_index < 0 or track_index >= len(self._song.tracks):
            raise IndexError("Track index out of range")
        return self._song.tracks[track_index]

    def _get_default_track_insert_index(self):
        selected_track = getattr(self._song.view, "selected_track", None)
        if selected_track is None:
            return -1

        for index, track in enumerate(self._song.tracks):
            if track == selected_track:
                return min(index + 1, len(self._song.tracks))

        return -1

    def _get_selected_track_index(self):
        selected_track = getattr(self._song.view, "selected_track", None)
        if selected_track is None:
            return None

        for index, track in enumerate(self._song.tracks):
            if track == selected_track:
                return index

        return None

    def _get_selected_scene_index(self):
        selected_scene = getattr(self._song.view, "selected_scene", None)
        if selected_scene is None:
            return None

        for index, scene in enumerate(self._song.scenes):
            if scene == selected_scene:
                return index

        return None

    def _get_highlighted_clip_slot_coords(self):
        clip_slot = getattr(self._song.view, "highlighted_clip_slot", None)
        if clip_slot is None:
            return None

        track_index = None
        clip_index = None

        for current_track_index, track in enumerate(self._song.tracks):
            for current_clip_index, current_slot in enumerate(track.clip_slots):
                if current_slot == clip_slot:
                    track_index = current_track_index
                    clip_index = current_clip_index
                    break
            if track_index is not None:
                break

        if track_index is None or clip_index is None:
            return None

        return {
            "track_index": track_index,
            "clip_index": clip_index,
        }

    def _require_scene(self, scene_index):
        if scene_index < 0 or scene_index >= len(self._song.scenes):
            raise IndexError("Scene index out of range")
        return self._song.scenes[scene_index]

    def _get_device_type(self, device):
        try:
            if device.can_have_drum_pads:
                return "drum_machine"
            if device.can_have_chains:
                return "rack"
            if "instrument" in device.class_display_name.lower():
                return "instrument"
            if "audio_effect" in device.class_name.lower():
                return "audio_effect"
            if "midi_effect" in device.class_name.lower():
                return "midi_effect"
            return "unknown"
        except Exception:
            return "unknown"
